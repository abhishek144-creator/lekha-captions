"""Caption font resolution: Google/Indic font maps, script detection and font downloads.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import os
import re
import shutil
import struct
import subprocess

import requests

try:
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:  # variable fonts then render at libass's default instance
    TTFont = None
    instantiateVariableFont = None


# Fonts baked into the image (Dockerfile copies them into the system fonts);
# with PREFER_PACKAGED_RENDER_FONTS=1 _ensure_font does not download them.
PACKAGED_FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flat_fonts")

# Instancing is pure table rewriting: ~1-5 s for Latin/Indic families, but
# ~20 s and far more memory for a 10 MB CJK font. Above this they keep
# libass's default instance.
MAX_VARIABLE_FONT_INSTANCE_BYTES = 4 * 1024 * 1024


def css_font_weight(font_weight, is_bold=False):
    """The numeric weight the editor and DOM renderer draw `font_weight` at."""
    raw = str(font_weight or '').strip().lower()
    weight = {'normal': 400, 'bold': 700}.get(raw)
    if weight is None:
        try:
            weight = int(float(raw))
        except ValueError:
            weight = 500  # the renderers' default when no weight is set
    weight = max(1, min(weight, 1000))
    return max(weight, 700) if is_bold else weight


GOOGLE_FONTS_MAP = {
    'Anton': {'url': 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf', 'file': 'Anton-Regular.ttf', 'ass_name': 'Anton'},
    'ArchivoBlack': {'url': 'https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf', 'file': 'ArchivoBlack-Regular.ttf', 'ass_name': 'Archivo Black'},
    'Bangers': {'url': 'https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf', 'file': 'Bangers-Regular.ttf', 'ass_name': 'Bangers'},
    'Arimo': {'url': 'https://github.com/google/fonts/raw/main/ofl/arimo/Arimo%5Bwght%5D.ttf', 'file': 'Arimo.ttf', 'ass_name': 'Arimo'},
    'BebasNeue': {'url': 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf', 'file': 'BebasNeue-Regular.ttf', 'ass_name': 'Bebas Neue'},
    'BodoniModa': {'url': 'https://github.com/google/fonts/raw/main/ofl/bodonimoda/BodoniModa%5Bopsz%2Cwght%5D.ttf', 'file': 'BodoniModa.ttf', 'ass_name': 'Bodoni Moda'},
    'Cardo': {'url': 'https://github.com/google/fonts/raw/main/ofl/cardo/Cardo-Regular.ttf', 'file': 'Cardo-Regular.ttf', 'ass_name': 'Cardo'},
    'Cinzel': {'url': 'https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf', 'file': 'Cinzel.ttf', 'ass_name': 'Cinzel'},
    'Comfortaa': {'url': 'https://github.com/google/fonts/raw/main/ofl/comfortaa/Comfortaa%5Bwght%5D.ttf', 'file': 'Comfortaa.ttf', 'ass_name': 'Comfortaa'},
    'CormorantGaramond': {'url': 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Regular.ttf', 'file': 'CormorantGaramond-Regular.ttf', 'ass_name': 'Cormorant Garamond'},
    'Exo2': {'url': 'https://github.com/google/fonts/raw/main/ofl/exo2/Exo2%5Bwght%5D.ttf', 'file': 'Exo2.ttf', 'ass_name': 'Exo 2'},
    'Fredoka': {'url': 'https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf', 'file': 'Fredoka.ttf', 'ass_name': 'Fredoka'},
    'Hind': {'url': 'https://github.com/google/fonts/raw/main/ofl/hind/Hind-Regular.ttf', 'file': 'Hind-Regular.ttf', 'ass_name': 'Hind'},
    'Inter': {'url': 'https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf', 'file': 'Inter.ttf', 'ass_name': 'Inter'},
    'JosefinSans': {'url': 'https://github.com/google/fonts/raw/main/ofl/josefinsans/JosefinSans%5Bwght%5D.ttf', 'file': 'JosefinSans.ttf', 'ass_name': 'Josefin Sans'},
    'Lato': {'url': 'https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf', 'file': 'Lato-Regular.ttf', 'ass_name': 'Lato'},
    'LeagueSpartan': {'url': 'https://github.com/google/fonts/raw/main/ofl/leaguespartan/LeagueSpartan%5Bwght%5D.ttf', 'file': 'LeagueSpartan.ttf', 'ass_name': 'League Spartan'},
    'LibreBaskerville': {'url': 'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf', 'file': 'LibreBaskerville-Regular.ttf', 'ass_name': 'Libre Baskerville'},
    'Lora': {'url': 'https://github.com/google/fonts/raw/main/ofl/lora/Lora%5Bwght%5D.ttf', 'file': 'Lora.ttf', 'ass_name': 'Lora'},
    'Marcellus': {'url': 'https://github.com/google/fonts/raw/main/ofl/marcellus/Marcellus-Regular.ttf', 'file': 'Marcellus-Regular.ttf', 'ass_name': 'Marcellus'},
    'Merriweather': {'url': 'https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf', 'file': 'Merriweather-Regular.ttf', 'ass_name': 'Merriweather'},
    'Montserrat': {'url': 'https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf', 'file': 'Montserrat.ttf', 'ass_name': 'Montserrat'},
    'Mulish': {'url': 'https://github.com/google/fonts/raw/main/ofl/mulish/Mulish%5Bwght%5D.ttf', 'file': 'Mulish.ttf', 'ass_name': 'Mulish'},
    'NotoSans': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSans.ttf', 'ass_name': 'Noto Sans'},
    'Nunito': {'url': 'https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bwght%5D.ttf', 'file': 'Nunito.ttf', 'ass_name': 'Nunito'},
    'OpenSans': {'url': 'https://github.com/google/fonts/raw/main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf', 'file': 'OpenSans.ttf', 'ass_name': 'Open Sans'},
    'Orbitron': {'url': 'https://github.com/google/fonts/raw/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf', 'file': 'Orbitron.ttf', 'ass_name': 'Orbitron'},
    'Oswald': {'url': 'https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf', 'file': 'Oswald.ttf', 'ass_name': 'Oswald'},
    'Pacifico': {'url': 'https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf', 'file': 'Pacifico-Regular.ttf', 'ass_name': 'Pacifico'},
    'PermanentMarker': {'url': 'https://github.com/google/fonts/raw/main/apache/permanentmarker/PermanentMarker-Regular.ttf', 'file': 'PermanentMarker-Regular.ttf', 'ass_name': 'Permanent Marker'},
    'PlayfairDisplay': {'url': 'https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf', 'file': 'PlayfairDisplay.ttf', 'ass_name': 'Playfair Display'},
    'Poppins': {'url': 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf', 'file': 'Poppins-Regular.ttf', 'ass_name': 'Poppins'},
    'Quicksand': {'url': 'https://github.com/google/fonts/raw/main/ofl/quicksand/Quicksand%5Bwght%5D.ttf', 'file': 'Quicksand.ttf', 'ass_name': 'Quicksand'},
    'Raleway': {'url': 'https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bwght%5D.ttf', 'file': 'Raleway.ttf', 'ass_name': 'Raleway'},
    'Roboto': {'url': 'https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf', 'file': 'Roboto.ttf', 'ass_name': 'Roboto'},
    'RockSalt': {'url': 'https://github.com/google/fonts/raw/main/apache/rocksalt/RockSalt-Regular.ttf', 'file': 'RockSalt-Regular.ttf', 'ass_name': 'Rock Salt'},
    'Special Elite': {'url': 'https://github.com/google/fonts/raw/main/apache/specialelite/SpecialElite-Regular.ttf', 'file': 'SpecialElite-Regular.ttf', 'ass_name': 'Special Elite'},
    'Rubik': {'url': 'https://github.com/google/fonts/raw/main/ofl/rubik/Rubik%5Bwght%5D.ttf', 'file': 'Rubik.ttf', 'ass_name': 'Rubik'},
    'SourceSans3': {'url': 'https://github.com/google/fonts/raw/main/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf', 'file': 'SourceSans3.ttf', 'ass_name': 'Source Sans 3'},
    'SpaceGrotesk': {'url': 'https://github.com/google/fonts/raw/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf', 'file': 'SpaceGrotesk.ttf', 'ass_name': 'Space Grotesk'},
    'Unna': {'url': 'https://github.com/google/fonts/raw/main/ofl/unna/Unna-Regular.ttf', 'file': 'Unna-Regular.ttf', 'ass_name': 'Unna'},
    'VarelaRound': {'url': 'https://github.com/google/fonts/raw/main/ofl/varelaround/VarelaRound-Regular.ttf', 'file': 'VarelaRound-Regular.ttf', 'ass_name': 'Varela Round'},
    'WorkSans': {'url': 'https://github.com/google/fonts/raw/main/ofl/worksans/WorkSans%5Bwght%5D.ttf', 'file': 'WorkSans.ttf', 'ass_name': 'Work Sans'},
    # TemplatesTab2 fonts
    'AbrilFatface': {'url': 'https://github.com/google/fonts/raw/main/ofl/abrilfatface/AbrilFatface-Regular.ttf', 'file': 'AbrilFatface-Regular.ttf', 'ass_name': 'Abril Fatface'},
    'Bitter': {'url': 'https://github.com/google/fonts/raw/main/ofl/bitter/Bitter%5Bwght%5D.ttf', 'file': 'Bitter.ttf', 'ass_name': 'Bitter'},
    'Caveat': {'url': 'https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf', 'file': 'Caveat.ttf', 'ass_name': 'Caveat'},
    'CrimsonText': {'url': 'https://github.com/google/fonts/raw/main/ofl/crimsontext/CrimsonText-Regular.ttf', 'file': 'CrimsonText-Regular.ttf', 'ass_name': 'Crimson Text'},
    'DarkerGrotesque': {'url': 'https://github.com/google/fonts/raw/main/ofl/darkergrotesque/DarkerGrotesque%5Bwght%5D.ttf', 'file': 'DarkerGrotesque.ttf', 'ass_name': 'Darker Grotesque'},
    'DelaGothicOne': {'url': 'https://github.com/google/fonts/raw/main/ofl/delagothicone/DelaGothicOne-Regular.ttf', 'file': 'DelaGothicOne-Regular.ttf', 'ass_name': 'Dela Gothic One'},
    'DMSerifDisplay': {'url': 'https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf', 'file': 'DMSerifDisplay-Regular.ttf', 'ass_name': 'DM Serif Display'},
    'IBMPlexMono': {'url': 'https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf', 'file': 'IBMPlexMono-Regular.ttf', 'ass_name': 'IBM Plex Mono'},
    'OverpassMono': {'url': 'https://github.com/google/fonts/raw/main/ofl/overpassmono/OverpassMono%5Bwght%5D.ttf', 'file': 'OverpassMono.ttf', 'ass_name': 'Overpass Mono'},
    'Questrial': {'url': 'https://github.com/google/fonts/raw/main/ofl/questrial/Questrial-Regular.ttf', 'file': 'Questrial-Regular.ttf', 'ass_name': 'Questrial'},
    'Righteous': {'url': 'https://github.com/google/fonts/raw/main/ofl/righteous/Righteous-Regular.ttf', 'file': 'Righteous-Regular.ttf', 'ass_name': 'Righteous'},
    'Silkscreen': {'url': 'https://github.com/google/fonts/raw/main/ofl/silkscreen/Silkscreen-Regular.ttf', 'file': 'Silkscreen-Regular.ttf', 'ass_name': 'Silkscreen'},
    'SpaceMono': {'url': 'https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Regular.ttf', 'file': 'SpaceMono-Regular.ttf', 'ass_name': 'Space Mono'},
    'Staatliches': {'url': 'https://github.com/google/fonts/raw/main/ofl/staatliches/Staatliches-Regular.ttf', 'file': 'Staatliches-Regular.ttf', 'ass_name': 'Staatliches'},
    'Unbounded': {'url': 'https://github.com/google/fonts/raw/main/ofl/unbounded/Unbounded%5Bwght%5D.ttf', 'file': 'Unbounded.ttf', 'ass_name': 'Unbounded'},
}

INDIC_FONTS = {
    # This is the SILENT auto-swap target for any Latin-only font on Devanagari
    # text (see the `_indic_safe` override below) — used on every plain/default
    # Hindi export, since 'Inter' (the app default) isn't Indic-safe. Verified
    # by direct FFmpeg/libass burn: Mukta-Regular.ttf renders adjacent
    # Devanagari words with NO visible space between them ("ये आपको" ->
    # "येआपको"), while Noto Sans Devanagari renders the identical text
    # correctly. Mukta itself remains a valid explicit choice in the frontend's
    # curated font list (fontUtils.jsx) — only the blind default changes here.
    'devanagari': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansDevanagari.ttf', 'ass_name': 'Noto Sans Devanagari'},
    'tamil': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamalar/MuktaMalar-Regular.ttf', 'file': 'MuktaMalar-Regular.ttf', 'ass_name': 'Mukta Malar'},
    'telugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansTelugu.ttf', 'ass_name': 'Noto Sans Telugu'},
    'bengali': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansBengali.ttf', 'ass_name': 'Noto Sans Bengali'},
    'gujarati': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamahee/MuktaMahee-Regular.ttf', 'file': 'MuktaMahee-Regular.ttf', 'ass_name': 'Mukta Mahee'},
    'kannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansKannada.ttf', 'ass_name': 'Noto Sans Kannada'},
    'malayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansMalayalam.ttf', 'ass_name': 'Noto Sans Malayalam'},
    'gurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktavaani/MuktaVaani-Regular.ttf', 'file': 'MuktaVaani-Regular.ttf', 'ass_name': 'Mukta Vaani'},
    'odia': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansoriya/NotoSansOriya%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansOriya.ttf', 'ass_name': 'Noto Sans Oriya'},
    'arabic': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansArabic.ttf', 'ass_name': 'Noto Sans Arabic'},
    'sinhala': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanssinhala/NotoSansSinhala%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansSinhala.ttf', 'ass_name': 'Noto Sans Sinhala'},
    'meetei': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansmeeteimayek/NotoSansMeeteiMayek%5Bwght%5D.ttf', 'file': 'NotoSansMeeteiMayek.ttf', 'ass_name': 'Noto Sans Meetei Mayek'},
    'olchiki': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansolchiki/NotoSansOlChiki%5Bwght%5D.ttf', 'file': 'NotoSansOlChiki.ttf', 'ass_name': 'Noto Sans Ol Chiki'},
    'hebrew': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansHebrew.ttf', 'ass_name': 'Noto Sans Hebrew'},
    'japanese': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf', 'file': 'NotoSansJP.ttf', 'ass_name': 'Noto Sans JP'},
    'chinese': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf', 'file': 'NotoSansSC.ttf', 'ass_name': 'Noto Sans SC'},
    'korean': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf', 'file': 'NotoSansKR.ttf', 'ass_name': 'Noto Sans KR'},
    'thai': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansThai.ttf', 'ass_name': 'Noto Sans Thai'},
    'burmese': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansmyanmar/NotoSansMyanmar%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansMyanmar.ttf', 'ass_name': 'Noto Sans Myanmar'},
    'khmer': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskhmer/NotoSansKhmer%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansKhmer.ttf', 'ass_name': 'Noto Sans Khmer'},
    'lao': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanslao/NotoSansLao%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansLao.ttf', 'ass_name': 'Noto Sans Lao'},
    'tibetan': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoseriftibetan/NotoSerifTibetan%5Bwght%5D.ttf', 'file': 'NotoSerifTibetan.ttf', 'ass_name': 'Noto Serif Tibetan'},
    'georgian': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansgeorgian/NotoSansGeorgian%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansGeorgian.ttf', 'ass_name': 'Noto Sans Georgian'},
    'armenian': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansarmenian/NotoSansArmenian%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansArmenian.ttf', 'ass_name': 'Noto Sans Armenian'},
    'ethiopic': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansethiopic/NotoSansEthiopic%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansEthiopic.ttf', 'ass_name': 'Noto Sans Ethiopic'},
}

SCRIPT_FONTS_MAP = {
    'Mukta': {'url': 'https://github.com/google/fonts/raw/main/ofl/mukta/Mukta-Regular.ttf', 'file': 'Mukta-Regular.ttf', 'ass_name': 'Mukta', 'script': 'devanagari'},
    'NotoSansDevanagari': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansDevanagari.ttf', 'ass_name': 'Noto Sans Devanagari', 'script': 'devanagari'},
    'Baloo2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf', 'file': 'Baloo2.ttf', 'ass_name': 'Baloo 2', 'script': 'devanagari'},
    'TiroDevanagariHindi': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirodevanagarihindiregular/TiroDevanagariHindi-Regular.ttf', 'file': 'TiroDevanagariHindi-Regular.ttf', 'ass_name': 'Tiro Devanagari Hindi', 'script': 'devanagari'},
    'Kalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/kalam/Kalam-Regular.ttf', 'file': 'Kalam-Regular.ttf', 'ass_name': 'Kalam', 'script': 'devanagari'},
    'Rajdhani': {'url': 'https://github.com/google/fonts/raw/main/ofl/rajdhani/Rajdhani-Regular.ttf', 'file': 'Rajdhani-Regular.ttf', 'ass_name': 'Rajdhani', 'script': 'devanagari'},
    # Devanagari faces scriptFontResolver.js maps Latin families onto. Full
    # files: the dynamic Google CSS fallback returns Latin-only subsets.
    'Amita': {'url': 'https://github.com/google/fonts/raw/main/ofl/amita/Amita-Regular.ttf', 'file': 'Amita-Regular.ttf', 'ass_name': 'Amita', 'script': 'devanagari'},
    'Arya': {'url': 'https://github.com/google/fonts/raw/main/ofl/arya/Arya-Regular.ttf', 'file': 'Arya-Regular.ttf', 'ass_name': 'Arya', 'script': 'devanagari'},
    'Asar': {'url': 'https://github.com/google/fonts/raw/main/ofl/asar/Asar-Regular.ttf', 'file': 'Asar-Regular.ttf', 'ass_name': 'Asar', 'script': 'devanagari'},
    'Eczar': {'url': 'https://github.com/google/fonts/raw/main/ofl/eczar/Eczar%5Bwght%5D.ttf', 'file': 'Eczar.ttf', 'ass_name': 'Eczar', 'script': 'devanagari'},
    'Halant': {'url': 'https://github.com/google/fonts/raw/main/ofl/halant/Halant-Regular.ttf', 'file': 'Halant-Regular.ttf', 'ass_name': 'Halant', 'script': 'devanagari'},
    'InknutAntiqua': {'url': 'https://github.com/google/fonts/raw/main/ofl/inknutantiqua/InknutAntiqua-Regular.ttf', 'file': 'InknutAntiqua-Regular.ttf', 'ass_name': 'Inknut Antiqua', 'script': 'devanagari'},
    'Karma': {'url': 'https://github.com/google/fonts/raw/main/ofl/karma/Karma-Regular.ttf', 'file': 'Karma-Regular.ttf', 'ass_name': 'Karma', 'script': 'devanagari'},
    'Khand': {'url': 'https://github.com/google/fonts/raw/main/ofl/khand/Khand-Regular.ttf', 'file': 'Khand-Regular.ttf', 'ass_name': 'Khand', 'script': 'devanagari'},
    'Kurale': {'url': 'https://github.com/google/fonts/raw/main/ofl/kurale/Kurale-Regular.ttf', 'file': 'Kurale-Regular.ttf', 'ass_name': 'Kurale', 'script': 'devanagari'},
    'Martel': {'url': 'https://github.com/google/fonts/raw/main/ofl/martel/Martel-Regular.ttf', 'file': 'Martel-Regular.ttf', 'ass_name': 'Martel', 'script': 'devanagari'},
    'RhodiumLibre': {'url': 'https://github.com/google/fonts/raw/main/ofl/rhodiumlibre/RhodiumLibre-Regular.ttf', 'file': 'RhodiumLibre-Regular.ttf', 'ass_name': 'Rhodium Libre', 'script': 'devanagari'},
    'RozhaOne': {'url': 'https://github.com/google/fonts/raw/main/ofl/rozhaone/RozhaOne-Regular.ttf', 'file': 'RozhaOne-Regular.ttf', 'ass_name': 'Rozha One', 'script': 'devanagari'},
    'Sahitya': {'url': 'https://github.com/google/fonts/raw/main/ofl/sahitya/Sahitya-Regular.ttf', 'file': 'Sahitya-Regular.ttf', 'ass_name': 'Sahitya', 'script': 'devanagari'},
    'Shrikhand': {'url': 'https://github.com/google/fonts/raw/main/ofl/shrikhand/Shrikhand-Regular.ttf', 'file': 'Shrikhand-Regular.ttf', 'ass_name': 'Shrikhand', 'script': 'devanagari'},
    'Sumana': {'url': 'https://github.com/google/fonts/raw/main/ofl/sumana/Sumana-Regular.ttf', 'file': 'Sumana-Regular.ttf', 'ass_name': 'Sumana', 'script': 'devanagari'},
    'Sura': {'url': 'https://github.com/google/fonts/raw/main/ofl/sura/Sura-Regular.ttf', 'file': 'Sura-Regular.ttf', 'ass_name': 'Sura', 'script': 'devanagari'},
    'Teko': {'url': 'https://github.com/google/fonts/raw/main/ofl/teko/Teko%5Bwght%5D.ttf', 'file': 'Teko.ttf', 'ass_name': 'Teko', 'script': 'devanagari'},
    'VesperLibre': {'url': 'https://github.com/google/fonts/raw/main/ofl/vesperlibre/VesperLibre-Regular.ttf', 'file': 'VesperLibre-Regular.ttf', 'ass_name': 'Vesper Libre', 'script': 'devanagari'},
    'Yantramanav': {'url': 'https://github.com/google/fonts/raw/main/ofl/yantramanav/Yantramanav-Regular.ttf', 'file': 'Yantramanav-Regular.ttf', 'ass_name': 'Yantramanav', 'script': 'devanagari'},

    'MuktaMalar': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamalar/MuktaMalar-Regular.ttf', 'file': 'MuktaMalar-Regular.ttf', 'ass_name': 'Mukta Malar', 'script': 'tamil'},
    'NotoSansTamil': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanstamil/NotoSansTamil%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansTamil.ttf', 'ass_name': 'Noto Sans Tamil', 'script': 'tamil'},
    'HindMadurai': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindmadurai/HindMadurai-Regular.ttf', 'file': 'HindMadurai-Regular.ttf', 'ass_name': 'Hind Madurai', 'script': 'tamil'},
    'Catamaran': {'url': 'https://github.com/google/fonts/raw/main/ofl/catamaran/Catamaran%5Bwght%5D.ttf', 'file': 'Catamaran.ttf', 'ass_name': 'Catamaran', 'script': 'tamil'},
    'TiroTamil': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirotamil/TiroTamil-Regular.ttf', 'file': 'TiroTamil-Regular.ttf', 'ass_name': 'Tiro Tamil', 'script': 'tamil'},
    'Arima': {'url': 'https://github.com/google/fonts/raw/main/ofl/arima/Arima%5Bwght%5D.ttf', 'file': 'Arima.ttf', 'ass_name': 'Arima', 'script': 'tamil'},
    'BalooThambi2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloothambi2/BalooThambi2%5Bwght%5D.ttf', 'file': 'BalooThambi2.ttf', 'ass_name': 'Baloo Thambi 2', 'script': 'tamil'},

    'NotoSansTelugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansTelugu.ttf', 'ass_name': 'Noto Sans Telugu', 'script': 'telugu'},
    'HindGuntur': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindguntur/HindGuntur-Regular.ttf', 'file': 'HindGuntur-Regular.ttf', 'ass_name': 'Hind Guntur', 'script': 'telugu'},
    'TiroTelugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirotelugu/TiroTelugu-Regular.ttf', 'file': 'TiroTelugu-Regular.ttf', 'ass_name': 'Tiro Telugu', 'script': 'telugu'},
    'BalooTammudu2': {'url': 'https://github.com/google/fonts/raw/main/ofl/balootammudu2/BalooTammudu2%5Bwght%5D.ttf', 'file': 'BalooTammudu2.ttf', 'ass_name': 'Baloo Tammudu 2', 'script': 'telugu'},
    'Mandali': {'url': 'https://github.com/google/fonts/raw/main/ofl/mandali/Mandali-Regular.ttf', 'file': 'Mandali-Regular.ttf', 'ass_name': 'Mandali', 'script': 'telugu'},
    'Ramabhadra': {'url': 'https://github.com/google/fonts/raw/main/ofl/ramabhadra/Ramabhadra-Regular.ttf', 'file': 'Ramabhadra-Regular.ttf', 'ass_name': 'Ramabhadra', 'script': 'telugu'},

    'NotoSansBengali': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansBengali.ttf', 'ass_name': 'Noto Sans Bengali', 'script': 'bengali'},
    'HindSiliguri': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindsiliguri/HindSiliguri-Regular.ttf', 'file': 'HindSiliguri-Regular.ttf', 'ass_name': 'Hind Siliguri', 'script': 'bengali'},
    'BalooDa2': {'url': 'https://github.com/google/fonts/raw/main/ofl/balooda2/BalooDa2%5Bwght%5D.ttf', 'file': 'BalooDa2.ttf', 'ass_name': 'Baloo Da 2', 'script': 'bengali'},
    'TiroBangla': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirobangla/TiroBangla-Regular.ttf', 'file': 'TiroBangla-Regular.ttf', 'ass_name': 'Tiro Bangla', 'script': 'bengali'},
    'Galada': {'url': 'https://github.com/google/fonts/raw/main/ofl/galada/Galada-Regular.ttf', 'file': 'Galada-Regular.ttf', 'ass_name': 'Galada', 'script': 'bengali'},
    'Atma': {'url': 'https://github.com/google/fonts/raw/main/ofl/atma/Atma-Regular.ttf', 'file': 'Atma-Regular.ttf', 'ass_name': 'Atma', 'script': 'bengali'},

    'MuktaMahee': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamahee/MuktaMahee-Regular.ttf', 'file': 'MuktaMahee-Regular.ttf', 'ass_name': 'Mukta Mahee', 'script': 'gujarati'},
    'NotoSansGujarati': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansgujarati/NotoSansGujarati%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansGujarati.ttf', 'ass_name': 'Noto Sans Gujarati', 'script': 'gujarati'},
    'HindVadodara': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindvadodara/HindVadodara-Regular.ttf', 'file': 'HindVadodara-Regular.ttf', 'ass_name': 'Hind Vadodara', 'script': 'gujarati'},
    'BalooBhai2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloobhai2/BalooBhai2%5Bwght%5D.ttf', 'file': 'BalooBhai2.ttf', 'ass_name': 'Baloo Bhai 2', 'script': 'gujarati'},
    'AnekGujarati': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekgujarati/AnekGujarati%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekGujarati.ttf', 'ass_name': 'Anek Gujarati', 'script': 'gujarati'},
    'NotoSerifGujarati': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifgujarati/NotoSerifGujarati%5Bwght%5D.ttf', 'file': 'NotoSerifGujarati.ttf', 'ass_name': 'Noto Serif Gujarati', 'script': 'gujarati'},
    'Rasa': {'url': 'https://github.com/google/fonts/raw/main/ofl/rasa/Rasa%5Bwght%5D.ttf', 'file': 'Rasa.ttf', 'ass_name': 'Rasa', 'script': 'gujarati'},

    'NotoSansKannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansKannada.ttf', 'ass_name': 'Noto Sans Kannada', 'script': 'kannada'},
    'HindMysuru': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindmysuru/HindMysuru-Regular.ttf', 'file': 'HindMysuru-Regular.ttf', 'ass_name': 'Hind Mysuru', 'script': 'kannada'},
    'BalooTamma2': {'url': 'https://github.com/google/fonts/raw/main/ofl/balootamma2/BalooTamma2%5Bwght%5D.ttf', 'file': 'BalooTamma2.ttf', 'ass_name': 'Baloo Tamma 2', 'script': 'kannada'},
    'TiroKannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirokannada/TiroKannada-Regular.ttf', 'file': 'TiroKannada-Regular.ttf', 'ass_name': 'Tiro Kannada', 'script': 'kannada'},
    'AnekKannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekkannada/AnekKannada%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekKannada.ttf', 'ass_name': 'Anek Kannada', 'script': 'kannada'},
    'NotoSerifKannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifkannada/NotoSerifKannada%5Bwght%5D.ttf', 'file': 'NotoSerifKannada.ttf', 'ass_name': 'Noto Serif Kannada', 'script': 'kannada'},

    'NotoSansMalayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansMalayalam.ttf', 'ass_name': 'Noto Sans Malayalam', 'script': 'malayalam'},
    'Manjari': {'url': 'https://github.com/google/fonts/raw/main/ofl/manjari/Manjari-Regular.ttf', 'file': 'Manjari-Regular.ttf', 'ass_name': 'Manjari', 'script': 'malayalam'},
    'BalooChettan2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloochettan2/BalooChettan2%5Bwght%5D.ttf', 'file': 'BalooChettan2.ttf', 'ass_name': 'Baloo Chettan 2', 'script': 'malayalam'},
    'TiroMalayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/tiromalayalam/TiroMalayalam-Regular.ttf', 'file': 'TiroMalayalam-Regular.ttf', 'ass_name': 'Tiro Malayalam', 'script': 'malayalam'},
    'Chilanka': {'url': 'https://github.com/google/fonts/raw/main/ofl/chilanka/Chilanka-Regular.ttf', 'file': 'Chilanka-Regular.ttf', 'ass_name': 'Chilanka', 'script': 'malayalam'},
    'AnekMalayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekmalayalam/AnekMalayalam%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekMalayalam.ttf', 'ass_name': 'Anek Malayalam', 'script': 'malayalam'},
    'Gayathri': {'url': 'https://github.com/google/fonts/raw/main/ofl/gayathri/Gayathri-Regular.ttf', 'file': 'Gayathri-Regular.ttf', 'ass_name': 'Gayathri', 'script': 'malayalam'},
    'NotoSerifMalayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifmalayalam/NotoSerifMalayalam%5Bwght%5D.ttf', 'file': 'NotoSerifMalayalam.ttf', 'ass_name': 'Noto Serif Malayalam', 'script': 'malayalam'},

    'MuktaVaani': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktavaani/MuktaVaani-Regular.ttf', 'file': 'MuktaVaani-Regular.ttf', 'ass_name': 'Mukta Vaani', 'script': 'gurmukhi'},
    'NotoSansGurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansgurmukhi/NotoSansGurmukhi%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansGurmukhi.ttf', 'ass_name': 'Noto Sans Gurmukhi', 'script': 'gurmukhi'},
    'HindJalandhar': {'url': 'https://github.com/google/fonts/raw/main/ofl/hindjalandhar/HindJalandhar-Regular.ttf', 'file': 'HindJalandhar-Regular.ttf', 'ass_name': 'Hind Jalandhar', 'script': 'gurmukhi'},
    'BalooPaaji2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloopaaji2/BalooPaaji2%5Bwght%5D.ttf', 'file': 'BalooPaaji2.ttf', 'ass_name': 'Baloo Paaji 2', 'script': 'gurmukhi'},
    'AnekGurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekgurmukhi/AnekGurmukhi%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekGurmukhi.ttf', 'ass_name': 'Anek Gurmukhi', 'script': 'gurmukhi'},
    'NotoSerifGurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifgurmukhi/NotoSerifGurmukhi%5Bwght%5D.ttf', 'file': 'NotoSerifGurmukhi.ttf', 'ass_name': 'Noto Serif Gurmukhi', 'script': 'gurmukhi'},
    'TiroGurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/tirogurmukhi/TiroGurmukhi-Regular.ttf', 'file': 'TiroGurmukhi-Regular.ttf', 'ass_name': 'Tiro Gurmukhi', 'script': 'gurmukhi'},

    'NotoSansOriya': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansoriya/NotoSansOriya%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansOriya.ttf', 'ass_name': 'Noto Sans Oriya', 'script': 'odia'},
    'BalooBhaina2': {'url': 'https://github.com/google/fonts/raw/main/ofl/baloobhaina2/BalooBhaina2%5Bwght%5D.ttf', 'file': 'BalooBhaina2.ttf', 'ass_name': 'Baloo Bhaina 2', 'script': 'odia'},
    'TiroOdia': {'url': 'https://github.com/google/fonts/raw/main/ofl/tiroodia/TiroOdia-Regular.ttf', 'file': 'TiroOdia-Regular.ttf', 'ass_name': 'Tiro Odia', 'script': 'odia'},
    'AnekOdia': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekodia/AnekOdia%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekOdia.ttf', 'ass_name': 'Anek Odia', 'script': 'odia'},
    'NotoSerifOriya': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoseriforiya/NotoSerifOriya%5Bwght%5D.ttf', 'file': 'NotoSerifOriya.ttf', 'ass_name': 'Noto Serif Oriya', 'script': 'odia'},

    'AnekTelugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/anektelugu/AnekTelugu%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekTelugu.ttf', 'ass_name': 'Anek Telugu', 'script': 'telugu'},
    'NotoSerifTelugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoseriftelugu/NotoSerifTelugu%5Bwght%5D.ttf', 'file': 'NotoSerifTelugu.ttf', 'ass_name': 'Noto Serif Telugu', 'script': 'telugu'},

    'AnekBangla': {'url': 'https://github.com/google/fonts/raw/main/ofl/anekbangla/AnekBangla%5Bwdth%2Cwght%5D.ttf', 'file': 'AnekBangla.ttf', 'ass_name': 'Anek Bangla', 'script': 'bengali'},
    'NotoSerifBengali': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifbengali/NotoSerifBengali%5Bwght%5D.ttf', 'file': 'NotoSerifBengali.ttf', 'ass_name': 'Noto Serif Bengali', 'script': 'bengali'},

    'NotoSansArabic': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansArabic.ttf', 'ass_name': 'Noto Sans Arabic', 'script': 'arabic'},
    'Cairo': {'url': 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf', 'file': 'Cairo.ttf', 'ass_name': 'Cairo', 'script': 'arabic'},
    'Tajawal': {'url': 'https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Regular.ttf', 'file': 'Tajawal-Regular.ttf', 'ass_name': 'Tajawal', 'script': 'arabic'},
    'Amiri': {'url': 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf', 'file': 'Amiri-Regular.ttf', 'ass_name': 'Amiri', 'script': 'arabic'},
    'ElMessiri': {'url': 'https://github.com/google/fonts/raw/main/ofl/elmessiri/ElMessiri%5Bwght%5D.ttf', 'file': 'ElMessiri.ttf', 'ass_name': 'El Messiri', 'script': 'arabic'},
    'ScheherazadeNew': {'url': 'https://github.com/google/fonts/raw/main/ofl/scheherazadenew/ScheherazadeNew-Regular.ttf', 'file': 'ScheherazadeNew-Regular.ttf', 'ass_name': 'Scheherazade New', 'script': 'arabic'},
    'Lateef': {'url': 'https://github.com/google/fonts/raw/main/ofl/lateef/Lateef-Regular.ttf', 'file': 'Lateef-Regular.ttf', 'ass_name': 'Lateef', 'script': 'arabic'},
    'ReadexPro': {'url': 'https://github.com/google/fonts/raw/main/ofl/readexpro/ReadexPro%5BHEXP%2Cwght%5D.ttf', 'file': 'ReadexPro.ttf', 'ass_name': 'Readex Pro', 'script': 'arabic'},

    'NotoSansSC': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf', 'file': 'NotoSansSC.ttf', 'ass_name': 'Noto Sans SC', 'script': 'chinese'},
    'NotoSansTC': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf', 'file': 'NotoSansTC.ttf', 'ass_name': 'Noto Sans TC', 'script': 'chinese'},
    'NotoSerifSC': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf', 'file': 'NotoSerifSC.ttf', 'ass_name': 'Noto Serif SC', 'script': 'chinese'},
    'ZCOOLXiaoWei': {'url': 'https://github.com/google/fonts/raw/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf', 'file': 'ZCOOLXiaoWei-Regular.ttf', 'ass_name': 'ZCOOL XiaoWei', 'script': 'chinese'},
    'ZCOOLQingKeHuangYou': {'url': 'https://github.com/google/fonts/raw/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf', 'file': 'ZCOOLQingKeHuangYou-Regular.ttf', 'ass_name': 'ZCOOL QingKe HuangYou', 'script': 'chinese'},
    'MaShanZheng': {'url': 'https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf', 'file': 'MaShanZheng-Regular.ttf', 'ass_name': 'Ma Shan Zheng', 'script': 'chinese'},
    'LiuJianMaoCao': {'url': 'https://github.com/google/fonts/raw/main/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf', 'file': 'LiuJianMaoCao-Regular.ttf', 'ass_name': 'Liu Jian Mao Cao', 'script': 'chinese'},
    'ZhiMangXing': {'url': 'https://github.com/google/fonts/raw/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf', 'file': 'ZhiMangXing-Regular.ttf', 'ass_name': 'Zhi Mang Xing', 'script': 'chinese'},

    'NotoSansJP': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf', 'file': 'NotoSansJP.ttf', 'ass_name': 'Noto Sans JP', 'script': 'japanese'},
    'MPLUSRounded1c': {'url': 'https://github.com/google/fonts/raw/main/ofl/mplusrounded1c/MPLUSRounded1c-Regular.ttf', 'file': 'MPLUSRounded1c-Regular.ttf', 'ass_name': 'M PLUS Rounded 1c', 'script': 'japanese'},
    'NotoSerifJP': {'url': 'https://github.com/google/fonts/raw/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf', 'file': 'NotoSerifJP.ttf', 'ass_name': 'Noto Serif JP', 'script': 'japanese'},
    'KosugiMaru': {'url': 'https://github.com/google/fonts/raw/main/ofl/kosugimaru/KosugiMaru-Regular.ttf', 'file': 'KosugiMaru-Regular.ttf', 'ass_name': 'Kosugi Maru', 'script': 'japanese'},
    'SawarabiMincho': {'url': 'https://github.com/google/fonts/raw/main/ofl/sawarabimincho/SawarabiMincho-Regular.ttf', 'file': 'SawarabiMincho-Regular.ttf', 'ass_name': 'Sawarabi Mincho', 'script': 'japanese'},
    'SawarabiGothic': {'url': 'https://github.com/google/fonts/raw/main/ofl/sawarabigothic/SawarabiGothic-Regular.ttf', 'file': 'SawarabiGothic-Regular.ttf', 'ass_name': 'Sawarabi Gothic', 'script': 'japanese'},
    'ZenMaruGothic': {'url': 'https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Regular.ttf', 'file': 'ZenMaruGothic-Regular.ttf', 'ass_name': 'Zen Maru Gothic', 'script': 'japanese'},
    'KiwiMaru': {'url': 'https://github.com/google/fonts/raw/main/ofl/kiwimaru/KiwiMaru-Regular.ttf', 'file': 'KiwiMaru-Regular.ttf', 'ass_name': 'Kiwi Maru', 'script': 'japanese'},

    'NotoSansKR': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf', 'file': 'NotoSansKR.ttf', 'ass_name': 'Noto Sans KR', 'script': 'korean'},
    'NanumGothic': {'url': 'https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf', 'file': 'NanumGothic-Regular.ttf', 'ass_name': 'Nanum Gothic', 'script': 'korean'},
    'NanumMyeongjo': {'url': 'https://github.com/google/fonts/raw/main/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf', 'file': 'NanumMyeongjo-Regular.ttf', 'ass_name': 'Nanum Myeongjo', 'script': 'korean'},
    'GothicA1': {'url': 'https://github.com/google/fonts/raw/main/ofl/gothica1/GothicA1-Regular.ttf', 'file': 'GothicA1-Regular.ttf', 'ass_name': 'Gothic A1', 'script': 'korean'},
    'DoHyeon': {'url': 'https://github.com/google/fonts/raw/main/ofl/dohyeon/DoHyeon-Regular.ttf', 'file': 'DoHyeon-Regular.ttf', 'ass_name': 'Do Hyeon', 'script': 'korean'},
    'Jua': {'url': 'https://github.com/google/fonts/raw/main/ofl/jua/Jua-Regular.ttf', 'file': 'Jua-Regular.ttf', 'ass_name': 'Jua', 'script': 'korean'},
    'BlackHanSans': {'url': 'https://github.com/google/fonts/raw/main/ofl/blackhansans/BlackHanSans-Regular.ttf', 'file': 'BlackHanSans-Regular.ttf', 'ass_name': 'Black Han Sans', 'script': 'korean'},
    'Sunflower': {'url': 'https://github.com/google/fonts/raw/main/ofl/sunflower/Sunflower-Medium.ttf', 'file': 'Sunflower-Medium.ttf', 'ass_name': 'Sunflower', 'script': 'korean'},

    'NotoSansThai': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansThai.ttf', 'ass_name': 'Noto Sans Thai', 'script': 'thai'},
    'Sarabun': {'url': 'https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf', 'file': 'Sarabun-Regular.ttf', 'ass_name': 'Sarabun', 'script': 'thai'},
    'Prompt': {'url': 'https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Regular.ttf', 'file': 'Prompt-Regular.ttf', 'ass_name': 'Prompt', 'script': 'thai'},
    'Kanit': {'url': 'https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf', 'file': 'Kanit-Regular.ttf', 'ass_name': 'Kanit', 'script': 'thai'},
    'Mitr': {'url': 'https://github.com/google/fonts/raw/main/ofl/mitr/Mitr-Regular.ttf', 'file': 'Mitr-Regular.ttf', 'ass_name': 'Mitr', 'script': 'thai'},
    'Pridi': {'url': 'https://github.com/google/fonts/raw/main/ofl/pridi/Pridi-Regular.ttf', 'file': 'Pridi-Regular.ttf', 'ass_name': 'Pridi', 'script': 'thai'},
    'Itim': {'url': 'https://github.com/google/fonts/raw/main/ofl/itim/Itim-Regular.ttf', 'file': 'Itim-Regular.ttf', 'ass_name': 'Itim', 'script': 'thai'},
    'Charm': {'url': 'https://github.com/google/fonts/raw/main/ofl/charm/Charm-Regular.ttf', 'file': 'Charm-Regular.ttf', 'ass_name': 'Charm', 'script': 'thai'},
}

# Each value is one (start, end) tuple or a list of them. Order matters:
# _detect_script returns the first script with any matching char, so Japanese
# kana must be checked before Han so mixed kana+kanji text resolves to Japanese.
SCRIPT_RANGES = {
    'devanagari': (0x0900, 0x097F),
    'bengali': (0x0980, 0x09FF),
    'gurmukhi': (0x0A00, 0x0A7F),
    'gujarati': (0x0A80, 0x0AFF),
    'odia': (0x0B00, 0x0B7F),
    'tamil': (0x0B80, 0x0BFF),
    'telugu': (0x0C00, 0x0C7F),
    'kannada': (0x0C80, 0x0CFF),
    'malayalam': (0x0D00, 0x0D7F),
    'sinhala': (0x0D80, 0x0DFF),
    'meetei': [(0xABC0, 0xABFF), (0xAAE0, 0xAAFF)],   # Manipuri (Meetei Mayek)
    'olchiki': (0x1C50, 0x1C7F),                       # Santali (Ol Chiki)
    'arabic': (0x0600, 0x06FF),
    'hebrew': (0x0590, 0x05FF),
    'japanese': [(0x3040, 0x309F), (0x30A0, 0x30FF)],  # kana before Han
    'chinese': (0x4E00, 0x9FFF),
    'korean': (0xAC00, 0xD7AF),
    'thai': (0x0E00, 0x0E7F),
    'burmese': (0x1000, 0x109F),
    'khmer': (0x1780, 0x17FF),
    'lao': (0x0E80, 0x0EFF),
    'tibetan': (0x0F00, 0x0FFF),                       # Dzongkha
    'georgian': [(0x10A0, 0x10FF), (0x1C90, 0x1CBF)],
    'armenian': (0x0530, 0x058F),
    'ethiopic': (0x1200, 0x137F),                      # Amharic
}

BOLD_VARIANTS = {
    'Poppins': {'url': 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf', 'file': 'Poppins-Bold.ttf'},
    'Lato': {'url': 'https://github.com/google/fonts/raw/main/ofl/lato/Lato-Bold.ttf', 'file': 'Lato-Bold.ttf'},
    'Hind': {'url': 'https://github.com/google/fonts/raw/main/ofl/hind/Hind-Bold.ttf', 'file': 'Hind-Bold.ttf'},
    'Cardo': {'url': 'https://github.com/google/fonts/raw/main/ofl/cardo/Cardo-Bold.ttf', 'file': 'Cardo-Bold.ttf'},
    'Merriweather': {'url': 'https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Bold.ttf', 'file': 'Merriweather-Bold.ttf'},
    'CormorantGaramond': {'url': 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Bold.ttf', 'file': 'CormorantGaramond-Bold.ttf'},
    'LibreBaskerville': {'url': 'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Bold.ttf', 'file': 'LibreBaskerville-Bold.ttf'},
}


# ── Script font resolution: Python port of scriptFontResolver.js ────────────
# The editor and the DOM export renderer pick a script-capable face with
# src/components/dashboard/scriptFontResolver.js (Inter on Hindi -> Poppins).
# The ASS path must pick the same face or a static caption changes font (and
# vertical metrics) once it is animated. Keep in sync with that file;
# backend/tests/test_script_font_resolution.py compares the two.
RESOLVER_SCRIPT_RANGES = {
    'devanagari': [(0x0900, 0x097F)],
    'bengali': [(0x0980, 0x09FF)],
    'punjabi': [(0x0A00, 0x0A7F)],
    'gujarati': [(0x0A80, 0x0AFF)],
    'odia': [(0x0B00, 0x0B7F)],
    'tamil': [(0x0B80, 0x0BFF)],
    'telugu': [(0x0C00, 0x0C7F)],
    'kannada': [(0x0C80, 0x0CFF)],
    'malayalam': [(0x0D00, 0x0D7F)],
    'sinhala': [(0x0D80, 0x0DFF)],
    'manipuri': [(0xABC0, 0xABFF), (0xAAE0, 0xAAFF)],
    'santali': [(0x1C50, 0x1C7F)],
    'arabic': [(0x0600, 0x06FF)],
    'hebrew': [(0x0590, 0x05FF)],
    'japanese': [(0x3040, 0x309F), (0x30A0, 0x30FF)],
    'chinese': [(0x4E00, 0x9FFF)],
    'korean': [(0xAC00, 0xD7AF)],
    'thai': [(0x0E00, 0x0E7F)],
    'burmese': [(0x1000, 0x109F)],
    'khmer': [(0x1780, 0x17FF)],
    'lao': [(0x0E80, 0x0EFF)],
    'tibetan': [(0x0F00, 0x0FFF)],
    'georgian': [(0x10A0, 0x10FF), (0x1C90, 0x1CBF)],
    'armenian': [(0x0530, 0x058F)],
    'ethiopic': [(0x1200, 0x137F)],
}

SCRIPT_PRIMARY_FONTS = {
    'devanagari': 'Noto Sans Devanagari',
    'bengali': 'Noto Sans Bengali',
    'punjabi': 'Noto Sans Gurmukhi',
    'gujarati': 'Noto Sans Gujarati',
    'odia': 'Noto Sans Oriya',
    'tamil': 'Noto Sans Tamil',
    'telugu': 'Noto Sans Telugu',
    'kannada': 'Noto Sans Kannada',
    'malayalam': 'Noto Sans Malayalam',
    'sinhala': 'Noto Sans Sinhala',
    'manipuri': 'Noto Sans Meetei Mayek',
    'santali': 'Noto Sans Ol Chiki',
    'arabic': 'Noto Sans Arabic',
    'hebrew': 'Noto Sans Hebrew',
    'japanese': 'Noto Sans JP',
    'chinese': 'Noto Sans SC',
    'korean': 'Noto Sans KR',
    'thai': 'Noto Sans Thai',
    'burmese': 'Noto Sans Myanmar',
    'khmer': 'Noto Sans Khmer',
    'lao': 'Noto Sans Lao',
    'tibetan': 'Noto Serif Tibetan',
    'georgian': 'Noto Sans Georgian',
    'armenian': 'Noto Sans Armenian',
    'ethiopic': 'Noto Sans Ethiopic',
}

DEVANAGARI_FONT_NAMES = {
    'Noto Sans Devanagari', 'Mukta', 'Hind', 'Poppins', 'Yantramanav',
    'Khand', 'Rajdhani', 'Teko', 'Kalam', 'Karma', 'Rozha One',
    'Vesper Libre', 'Amita', 'Shrikhand', 'Halant', 'Kurale', 'Arya',
    'Inknut Antiqua', 'Eczar', 'Sahitya', 'Rhodium Libre', 'Sumana',
    'Martel', 'Sura', 'Asar',
}

LATIN_TO_DEVANAGARI_FONT = {
    'IBM Plex Mono': 'Karma',
    'Space Mono': 'Karma',
    'Special Elite': 'Karma',
    'Courier Prime': 'Karma',
    'Oxanium': 'Rajdhani',
    'Orbitron': 'Rajdhani',
    'Exo 2': 'Rajdhani',
    'Syne': 'Yantramanav',
    'Raleway': 'Mukta',
    'Josefin Sans': 'Mukta',
    'Montserrat': 'Poppins',
    'Poppins': 'Poppins',
    'Inter': 'Poppins',
    'DM Sans': 'Hind',
    'Anton': 'Teko',
    'Antonio': 'Teko',
    'Bebas Neue': 'Khand',
    'Barlow Condensed': 'Khand',
    'Oswald': 'Rajdhani',
    'Archivo Black': 'Yantramanav',
    'Bodoni Moda': 'Rozha One',
    'Playfair Display': 'Inknut Antiqua',
    'Gloock': 'Rhodium Libre',
    'DM Serif Display': 'Vesper Libre',
    'Cinzel': 'Arya',
    'Abril Fatface': 'Shrikhand',
    'Cormorant Garamond': 'Eczar',
    'EB Garamond': 'Kurale',
    'Libre Baskerville': 'Sumana',
    'Spectral': 'Sura',
    'Lora': 'Martel',
    'Merriweather': 'Martel',
    'Noto Serif': 'Martel',
    'Bitter': 'Sahitya',
    'Caveat': 'Kalam',
    'Pacifico': 'Kalam',
    'Dancing Script': 'Kalam',
}

_DEVANAGARI_FALLBACK_RULES = [
    (r'mono|courier|typewriter|plex mono|special elite', 'Karma'),
    (r'oxanium|orbitron|syne|techno|exo', 'Rajdhani'),
    (r'antonio|anton', 'Teko'),
    (r'archivo black|black|heavy|ultra', 'Yantramanav'),
    (r'condensed|narrow|oswald|bebas|barlow|impact|khand|teko', 'Khand'),
    (r'cinzel|trajan|titling', 'Arya'),
    (r'playfair|abril|fatface', 'Inknut Antiqua'),
    (r'bodoni|didot|gloock', 'Rozha One'),
    (r'dm serif|rozha|fat', 'Vesper Libre'),
    (r'serif|garamond|baskerville|georgia|times|lora|bitter|merriweather|cormorant|spectral|noto serif', 'Eczar'),
    (r'script|hand|caveat|pacifico|dancing|brush', 'Kalam'),
]


def detect_text_script(text):
    """Dominant script of text, exactly like scriptFontResolver.detectScript."""
    counts = {script: 0 for script in RESOLVER_SCRIPT_RANGES}
    latin_count = 0
    for character in str(text or ''):
        code_point = ord(character)
        matched = False
        for script, ranges in RESOLVER_SCRIPT_RANGES.items():
            if any(start <= code_point <= end for start, end in ranges):
                counts[script] += 1
                matched = True
                break
        if not matched and (0x41 <= code_point <= 0x5A or 0x61 <= code_point <= 0x7A):
            latin_count += 1
    dominant_script, dominant_count = 'latin', latin_count
    for script, count in counts.items():
        if count > dominant_count:
            dominant_script, dominant_count = script, count
    return dominant_script


def resolve_script_font_family(font_family, text):
    """Family the DOM renderer draws text in (scriptFontResolver.resolveScriptFontFamily
    without a font catalog, which is how render_template_overlay.mjs calls it)."""
    script = detect_text_script(text)
    family = str(font_family or '').strip()
    if script == 'latin':
        return family or 'Noto Sans'
    primary_family = SCRIPT_PRIMARY_FONTS.get(script) or family or 'Noto Sans'
    if not family:
        return primary_family
    if script == 'devanagari':
        if family in DEVANAGARI_FONT_NAMES:
            return family
        if family in LATIN_TO_DEVANAGARI_FONT:
            return LATIN_TO_DEVANAGARI_FONT[family]
        for pattern, fallback in _DEVANAGARI_FALLBACK_RULES:
            if re.search(pattern, family, re.IGNORECASE):
                return fallback
        return SCRIPT_PRIMARY_FONTS['devanagari']
    return primary_family


# libass sizes a face so its GDI cell (OS/2 usWinAscent + usWinDescent, or
# hhea ascender - descender when those are zero) equals the ASS Fontsize; CSS
# sizes the em square. Cell / em is 1.2-2.0 across the bundled fonts. Used when
# the font file cannot be read: 1.6 is the old fixed 4.8x/3.0x ratio, so an
# unreadable font keeps its previous ASS size.
DEFAULT_ASS_CELL_HEIGHT_RATIO = 1.6
_cell_height_ratio_cache = {}


def read_font_cell_height_ratio(font_path):
    """Return (cell height / units per em) for a TrueType/OpenType file, or None."""
    if font_path in _cell_height_ratio_cache:
        return _cell_height_ratio_cache[font_path]
    ratio = None
    try:
        with open(font_path, 'rb') as handle:
            data = handle.read()
        num_tables = struct.unpack('>H', data[4:6])[0]
        tables = {}
        for index in range(num_tables):
            tag, _checksum, offset, _length = struct.unpack('>4sIII', data[12 + 16 * index:28 + 16 * index])
            tables[tag] = offset
        head, os2, hhea = tables.get(b'head'), tables.get(b'OS/2'), tables.get(b'hhea')
        units_per_em = struct.unpack('>H', data[head + 18:head + 20])[0] if head is not None else 0
        cell = 0
        if os2 is not None:
            # libass reads these as signed shorts (ass_font.c set_font_metrics).
            win_ascent, win_descent = struct.unpack('>hh', data[os2 + 74:os2 + 78])
            cell = win_ascent + win_descent
        if cell <= 0 and hhea is not None:
            ascender, descender = struct.unpack('>hh', data[hhea + 4:hhea + 8])
            cell = ascender - descender
        if units_per_em > 0 and cell > 0:
            ratio = cell / units_per_em
    except (OSError, struct.error, TypeError):
        ratio = None
    _cell_height_ratio_cache[font_path] = ratio
    return ratio


def font_covers_codepoint(font_path, code_point):
    """True/False from the font's Unicode cmap, or None when it cannot be read."""
    try:
        with open(font_path, 'rb') as handle:
            data = handle.read()
        num_tables = struct.unpack('>H', data[4:6])[0]
        cmap = None
        for index in range(num_tables):
            tag, _checksum, offset, _length = struct.unpack('>4sIII', data[12 + 16 * index:28 + 16 * index])
            if tag == b'cmap':
                cmap = offset
        if cmap is None:
            return None
        subtables = {}
        for index in range(struct.unpack('>H', data[cmap + 2:cmap + 4])[0]):
            platform, encoding, offset = struct.unpack('>HHI', data[cmap + 4 + 8 * index:cmap + 12 + 8 * index])
            subtables[(platform, encoding)] = cmap + offset
        for key in ((3, 10), (0, 4), (3, 1), (0, 3)):
            table = subtables.get(key)
            if table is None:
                continue
            table_format = struct.unpack('>H', data[table:table + 2])[0]
            if table_format == 12:
                for group in range(struct.unpack('>I', data[table + 12:table + 16])[0]):
                    start, end, _glyph = struct.unpack('>III', data[table + 16 + 12 * group:table + 28 + 12 * group])
                    if start <= code_point <= end:
                        return True
                return False
            if table_format == 4:
                if code_point > 0xFFFF:
                    return False
                seg_count = struct.unpack('>H', data[table + 6:table + 8])[0] // 2
                ends = table + 14
                starts = ends + 2 * seg_count + 2
                deltas = starts + 2 * seg_count
                range_offsets = deltas + 2 * seg_count
                for seg in range(seg_count):
                    end = struct.unpack('>H', data[ends + 2 * seg:ends + 2 * seg + 2])[0]
                    if code_point > end:
                        continue
                    start = struct.unpack('>H', data[starts + 2 * seg:starts + 2 * seg + 2])[0]
                    if code_point < start:
                        return False
                    delta = struct.unpack('>h', data[deltas + 2 * seg:deltas + 2 * seg + 2])[0]
                    range_offset_at = range_offsets + 2 * seg
                    range_offset = struct.unpack('>H', data[range_offset_at:range_offset_at + 2])[0]
                    if range_offset == 0:
                        return (code_point + delta) & 0xFFFF != 0
                    glyph_at = range_offset_at + range_offset + 2 * (code_point - start)
                    glyph = struct.unpack('>H', data[glyph_at:glyph_at + 2])[0]
                    return glyph != 0
                return False
        return None
    except (OSError, struct.error, TypeError, IndexError):
        return None


class FontAssetsMixin:
    def _font_file_candidates(self, font_info):
        """Files libass may load for font_info: the fonts_dir copy, then the
        packaged font fontconfig resolves (production images)."""
        candidates = []
        if font_info and font_info.get('file'):
            candidates.append(os.path.join(self.fonts_dir, font_info['file']))
        if font_info and font_info.get('ass_name') and self._packaged_font_available(font_info['ass_name']):
            try:
                result = subprocess.run(
                    ["fc-match", "-f", "%{file}", font_info['ass_name']],
                    capture_output=True, text=True, timeout=3, check=True,
                )
                candidates.append(result.stdout.strip())
            except (OSError, subprocess.SubprocessError):
                pass
        return [path for path in candidates if path and os.path.isfile(path)]

    def _font_lacks_text_glyphs(self, font_info, text):
        """True only when the font file is readable and has no glyph for the
        first character of text's dominant script (e.g. a Latin-only subset)."""
        script = detect_text_script(text)
        ranges = RESOLVER_SCRIPT_RANGES.get(script)
        if not ranges:
            return False
        sample = next((ord(ch) for ch in str(text or '') if any(start <= ord(ch) <= end for start, end in ranges)), None)
        if sample is None:
            return False
        for path in self._font_file_candidates(font_info):
            covered = font_covers_codepoint(path, sample)
            if covered is not None:
                return not covered
        return False

    def _ass_cell_height_ratio(self, font_info):
        """Cell/em ratio of the file libass will load for font_info, so a CSS
        px size can be converted to the ASS Fontsize that draws the same glyphs."""
        for path in self._font_file_candidates(font_info):
            ratio = read_font_cell_height_ratio(path)
            if ratio:
                return ratio
        return DEFAULT_ASS_CELL_HEIGHT_RATIO

    def _ensure_fallback_font(self):
        fallback_path = os.path.join(self.fonts_dir, "Inter.ttf")
        if self._packaged_font_available("Inter"):
            return
        if not os.path.exists(fallback_path):
            try:
                info = GOOGLE_FONTS_MAP.get('Inter')
                if info:
                    r = requests.get(info['url'], allow_redirects=True, timeout=15)
                    with open(fallback_path, 'wb') as f:
                        f.write(r.content)
                    print("Downloaded fallback font: Inter")
            except Exception as e:
                print(f"Fallback font download failed: {e}")

    def _detect_script(self, text):
        for script_name, ranges in SCRIPT_RANGES.items():
            if isinstance(ranges, tuple):
                ranges = [ranges]
            for range_start, range_end in ranges:
                for ch in text:
                    if range_start <= ord(ch) <= range_end:
                        return script_name
        return None

    def _ensure_indic_font(self, script_name):
        info = INDIC_FONTS.get(script_name)
        if not info:
            return None
        font_path = os.path.join(self.fonts_dir, info['file'])
        if self._packaged_font_available(info['ass_name']):
            return info
        if not os.path.exists(font_path):
            try:
                print(f"Downloading Indic font for {script_name}: {info['file']}")
                r = requests.get(info['url'], allow_redirects=True, timeout=20)
                if r.status_code == 200 and len(r.content) > 1000:
                    with open(font_path, 'wb') as f:
                        f.write(r.content)
                    print(f"Downloaded: {info['file']}")
                else:
                    print(f"Bad response downloading {script_name} font")
                    return None
            except Exception as e:
                print(f"Failed to download {script_name} font: {e}")
                return None
        return info

    FONT_ALIASES = {
        # 'Noto Sans' (plain) is now in GOOGLE_FONTS_MAP as the Latin variant — no alias needed.
        # Only alias the Devanagari-specific name so Indian-script captions still auto-download.
        'Noto Sans Devanagari': 'devanagari',
        'Noto Sans Tamil': 'tamil',
        'Noto Sans Telugu': 'telugu',
        'Noto Sans Bengali': 'bengali',
        'Noto Sans Gujarati': 'gujarati',
        'Noto Sans Kannada': 'kannada',
        'Noto Sans Malayalam': 'malayalam',
        'Noto Sans Gurmukhi': 'gurmukhi',
        'Noto Sans Oriya': 'odia',
        'Noto Sans Arabic': 'arabic',
        'Mukta Malar': 'tamil',
        'Mukta Mahee': 'gujarati',
        'Mukta Vaani': 'gurmukhi',
        'Noto Sans Sinhala': 'sinhala',
        'Noto Sans Meetei Mayek': 'meetei',
        'Noto Sans Ol Chiki': 'olchiki',
        'Noto Sans Hebrew': 'hebrew',
        'Noto Sans JP': 'japanese',
        'Noto Sans SC': 'chinese',
        'Noto Sans TC': 'chinese',
        'Noto Sans KR': 'korean',
        'Noto Sans Thai': 'thai',
        'Noto Sans Myanmar': 'burmese',
        'Noto Sans Khmer': 'khmer',
        'Noto Sans Lao': 'lao',
        'Noto Serif Tibetan': 'tibetan',
        'Noto Sans Georgian': 'georgian',
        'Noto Sans Armenian': 'armenian',
        'Noto Sans Ethiopic': 'ethiopic',
    }

    # Font names arrive straight from the client (style.font_family and the
    # per-word wordStyles[].fontFamily). An unrecognised name reaches the
    # dynamic Google Fonts resolver, where it becomes BOTH a filesystem path
    # ("<font_key>-Regular.ttf" joined onto fonts_dir) and the ass_name that is
    # interpolated into the comma-separated "Style:" line of the ASS file. Google
    # currently rejects malformed family names, but that is an external service's
    # validation, not ours — so constrain the name here. All 326 names across
    # GOOGLE_FONTS_MAP / SCRIPT_FONTS_MAP / INDIC_FONTS / FONT_ALIASES satisfy
    # this pattern, so no legitimate font is affected.
    _FONT_KEY_PATTERN = re.compile(r"^[A-Za-z0-9 _-]{1,64}$")

    def _packaged_font_available(self, family):
        if os.environ.get("PREFER_PACKAGED_RENDER_FONTS") != "1" or not shutil.which("fc-match"):
            return False
        if family in self._packaged_font_matches:
            return self._packaged_font_matches[family]
        try:
            result = subprocess.run(
                ["fc-match", "-f", "%{family}\n", family],
                capture_output=True, text=True, timeout=3, check=True,
            )
            wanted = re.sub(r"[^a-z0-9]", "", family.lower())
            found = [re.sub(r"[^a-z0-9]", "", name.lower())
                     for name in result.stdout.strip().split(",")]
            matched = wanted in found
        except (OSError, subprocess.SubprocessError):
            matched = False
        self._packaged_font_matches[family] = matched
        return matched

    def _weighted_font_family(self, info, weight):
        """ASS family that draws `info` at `weight`, or None to keep its ass_name.

        libass only draws a variable font's default instance (Inter's is
        wght 400) and its faux bold barely thickens it, so an 800 caption
        exported at regular weight. Write a static instance under a family
        name only it carries; the other axes stay at their defaults, which is
        what the editor's Google Fonts CSS serves. Static fonts return None.
        """
        if instantiateVariableFont is None or not info or not info.get('file'):
            return None
        source = next((
            path for path in (
                os.path.join(self.fonts_dir, info['file']),
                os.path.join(PACKAGED_FONTS_DIR, info['file']),
            ) if os.path.isfile(path)
        ), None)
        if not source or os.path.getsize(source) > MAX_VARIABLE_FONT_INSTANCE_BYTES:
            return None
        cache_key = (source, os.path.getmtime(source), weight)
        if cache_key in self._variable_font_instances:
            return self._variable_font_instances[cache_key]

        family = None
        try:
            font = TTFont(source)
            axes = {axis.axisTag: axis for axis in font['fvar'].axes} if 'fvar' in font else {}
            if 'wght' in axes:
                wght = axes['wght']
                weight = int(round(max(wght.minValue, min(weight, wght.maxValue))))
                family = f"{info['ass_name']} Lekha W{weight}"
                stem = os.path.splitext(info['file'])[0]
                target = os.path.join(self.fonts_dir, f"{stem}-lekha-w{weight}.ttf")
                if not os.path.isfile(target) or os.path.getmtime(target) < os.path.getmtime(source):
                    location = {tag: (weight if tag == 'wght' else axis.defaultValue) for tag, axis in axes.items()}
                    instance = instantiateVariableFont(font, location)
                    names = instance['name']
                    for name_id in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25):
                        names.removeNames(nameID=name_id)
                    postscript = re.sub(r'[^A-Za-z0-9-]', '', family.replace(' ', '-'))[:63]
                    for name_id, value in ((1, family), (2, 'Regular'), (3, postscript), (4, family), (6, postscript)):
                        names.setName(value, name_id, 3, 1, 0x409)
                    instance['OS/2'].usWeightClass = weight
                    # Concurrent exports may build the same instance; never
                    # let libass load a half-written file.
                    partial = f"{target}.{os.getpid()}.tmp"
                    try:
                        instance.save(partial)
                        os.replace(partial, target)
                    except OSError:
                        # Windows refuses to replace a file another ffmpeg has
                        # open; that copy was built from the same source.
                        if not os.path.isfile(target):
                            raise
                    finally:
                        if os.path.exists(partial):
                            os.remove(partial)
                    print(f"[Fonts] Built {info['ass_name']} weight {weight} instance: {os.path.basename(target)}")
        except Exception as e:
            print(f"[Fonts] Could not instance {info['file']} at weight {weight}: {e}")
            family = None
        self._variable_font_instances[cache_key] = family
        return family

    def _ensure_font(self, font_key):
        if not self._FONT_KEY_PATTERN.match(str(font_key or "")):
            print(f"Rejected malformed font name {str(font_key)[:80]!r}, falling back to Inter")
            font_key = "Inter"
        info = GOOGLE_FONTS_MAP.get(font_key)
        if not info:
            for k, v in GOOGLE_FONTS_MAP.items():
                if v['ass_name'].lower() == font_key.lower():
                    info = v
                    font_key = k
                    print(f"Font matched by display name: {v['ass_name']}")
                    break
        if not info:
            for k, v in SCRIPT_FONTS_MAP.items():
                if v['ass_name'].lower() == font_key.lower() or k.lower() == font_key.lower():
                    info = v
                    font_key = k
                    print(f"Font matched in SCRIPT_FONTS_MAP: {v['ass_name']}")
                    break
        if not info:
            for k, v in INDIC_FONTS.items():
                if v['ass_name'].lower() == font_key.lower():
                    info = v
                    font_key = k
                    print(f"Font matched in INDIC_FONTS: {v['ass_name']}")
                    break
        if not info:
            alias_script = self.FONT_ALIASES.get(font_key)
            if alias_script:
                indic_info = INDIC_FONTS.get(alias_script)
                if indic_info:
                    info = indic_info
                    font_key = alias_script
                    print(f"Font '{font_key}' matched via alias to INDIC_FONTS: {indic_info['ass_name']}")
        if not info:
            # Try to fetch from Google Fonts API dynamically
            try:
                headers = {'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.1.1; en-gb; Build/KLP) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30'}
                formatted_name = font_key.replace(" ", "+")
                r_css = requests.get(f"https://fonts.googleapis.com/css?family={formatted_name}", headers=headers, timeout=5)
                if r_css.status_code == 200:
                    import re
                    match = re.search(r'url\((.*?\.ttf)\)', r_css.text)
                    if match:
                        ttf_url = match.group(1)
                        if not ttf_url.startswith('https://fonts.gstatic.com/'):
                            print(f"Rejected untrusted font URL for '{font_key}': {ttf_url}")
                        else:
                            info = {
                                "ass_name": font_key,
                                "file": f"{font_key.replace(' ', '')}-Regular.ttf",
                                "url": ttf_url
                            }
                            print(f"Dynamically resolved Google Font '{font_key}' -> {ttf_url}")
            except Exception as e:
                print(f"Dynamic font resolution failed for {font_key}: {e}")

        if not info:
            print(f"Font '{font_key}' not in map and dynamic fetch failed, falling back to Inter")
            info = GOOGLE_FONTS_MAP.get('Inter')
            font_key = 'Inter'

        font_path = os.path.join(self.fonts_dir, info['file'])
        if self._packaged_font_available(info['ass_name']):
            return info
        if not os.path.exists(font_path):
            try:
                print(f"Downloading font: {font_key}")
                r = requests.get(info['url'], allow_redirects=True, timeout=15)
                if r.status_code == 200 and len(r.content) > 1000:
                    with open(font_path, 'wb') as f:
                        f.write(r.content)
                    print(f"Downloaded: {info['file']}")
                else:
                    print(f"Font download returned bad response for {font_key}, using Inter")
                    info = GOOGLE_FONTS_MAP.get('Inter')
                    font_path = os.path.join(self.fonts_dir, info['file'])
            except Exception as e:
                print(f"Font download failed for {font_key}: {e}, using Inter")
                info = GOOGLE_FONTS_MAP.get('Inter')
                font_path = os.path.join(self.fonts_dir, info['file'])

        # Ensure the fallback font (Inter) is also downloaded if not present
        if not os.path.exists(font_path):
            try:
                print(f"Downloading fallback font: {info['file']}")
                r = requests.get(info['url'], allow_redirects=True, timeout=15)
                if r.status_code == 200 and len(r.content) > 1000:
                    with open(font_path, 'wb') as f:
                        f.write(r.content)
                    print(f"Downloaded fallback: {info['file']}")
            except Exception as e:
                print(f"Fallback font download also failed: {e}")

        return info
