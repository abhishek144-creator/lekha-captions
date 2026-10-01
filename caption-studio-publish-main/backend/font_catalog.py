"""Font catalog for burned-in captions: download sources and ASS names per
font, script-specific fonts, Unicode script ranges and bold variants.

Pure data, moved from processor.py; processor imports every name from here.
"""

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
