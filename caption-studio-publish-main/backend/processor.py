import os
import asyncio
import subprocess
import tempfile
import requests
import json
import math
import re
import shutil
import uuid
from openai import OpenAI
from sarvamai import SarvamAI

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
    'devanagari': {'url': 'https://github.com/google/fonts/raw/main/ofl/mukta/Mukta-Regular.ttf', 'file': 'Mukta-Regular.ttf', 'ass_name': 'Mukta'},
    'tamil': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamalar/MuktaMalar-Regular.ttf', 'file': 'MuktaMalar-Regular.ttf', 'ass_name': 'Mukta Malar'},
    'telugu': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansTelugu.ttf', 'ass_name': 'Noto Sans Telugu'},
    'bengali': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansBengali.ttf', 'ass_name': 'Noto Sans Bengali'},
    'gujarati': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktamahee/MuktaMahee-Regular.ttf', 'file': 'MuktaMahee-Regular.ttf', 'ass_name': 'Mukta Mahee'},
    'kannada': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansKannada.ttf', 'ass_name': 'Noto Sans Kannada'},
    'malayalam': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansMalayalam.ttf', 'ass_name': 'Noto Sans Malayalam'},
    'gurmukhi': {'url': 'https://github.com/google/fonts/raw/main/ofl/muktavaani/MuktaVaani-Regular.ttf', 'file': 'MuktaVaani-Regular.ttf', 'ass_name': 'Mukta Vaani'},
    'odia': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansoriya/NotoSansOriya%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansOriya.ttf', 'ass_name': 'Noto Sans Oriya'},
    'arabic': {'url': 'https://github.com/google/fonts/raw/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf', 'file': 'NotoSansArabic.ttf', 'ass_name': 'Noto Sans Arabic'},
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
    'arabic': (0x0600, 0x06FF),
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


class VideoProcessor:
    def __init__(self, fonts_dir):
        self.fonts_dir = os.path.abspath(fonts_dir)
        self.backend_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.dirname(self.backend_dir)
        self.template_overlay_script = os.path.join(self.project_root, "scripts", "render_template_overlay.mjs")
        os.makedirs(self.fonts_dir, exist_ok=True)
        self.client = None # Lazy init
        self._ensure_fallback_font()

    def _ensure_fallback_font(self):
        fallback_path = os.path.join(self.fonts_dir, "Inter.ttf")
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
        for script_name, (range_start, range_end) in SCRIPT_RANGES.items():
            for ch in text:
                if range_start <= ord(ch) <= range_end:
                    return script_name
        return None

    def _ensure_indic_font(self, script_name):
        info = INDIC_FONTS.get(script_name)
        if not info:
            return None
        font_path = os.path.join(self.fonts_dir, info['file'])
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
    }

    def _ensure_font(self, font_key):
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
                        # Create dynamic info object
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

    async def generate_captions_only(self, input_p, target_language="English", min_words=0, max_words=0):
        print(f"Processing: {input_p} -> Target: {target_language}, Words: {min_words}-{max_words}")
        try:
            # Try to initialize client if not ready
            if not self.client:
                try:
                    self.client = OpenAI()
                except Exception as e:
                    print(f"[Warning] OpenAI Init Warning: {e}. Proceeding to mock fallback.")
            
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
                audio_p = _tf.name
            subprocess.run(["ffmpeg", "-y", "-i", input_p, "-vn", "-ar", "16000", "-ac", "1", audio_p],
                           check=True, capture_output=True)

            # Clean up logic
            words = []
            api_error_msg = None
            detected_language = (target_language or "unknown").lower()
            language_confidence = 0.6

            sarvam_langs = {
                'hindi': 'hi-IN', 'bengali': 'bn-IN', 'kannada': 'kn-IN',
                'malayalam': 'ml-IN', 'marathi': 'mr-IN', 'odia': 'od-IN',
                'punjabi': 'pa-IN', 'tamil': 'ta-IN', 'telugu': 'te-IN',
                'gujarati': 'gu-IN', 'assamese': 'as-IN'
            }

            # Whisper ISO 639-1 language codes for non-Indian languages
            whisper_lang_codes = {
                'english': 'en', 'english_us': 'en', 'english_uk': 'en',
                'english_australia': 'en', 'english_new_zealand': 'en',
                'english_india': 'en',
                'arabic': 'ar', 'bulgarian': 'bg', 'burmese': 'my',
                'catalan': 'ca', 'chinese_simplified': 'zh',
                'chinese_traditional': 'zh', 'chinese_cantonese': 'zh',
                'czech': 'cs', 'danish': 'da', 'danish_denmark': 'da',
                'dutch': 'nl', 'dutch_belgium': 'nl', 'dzongkha': 'dz',
                'estonian': 'et', 'finnish': 'fi', 'french': 'fr',
                'french_canada': 'fr', 'german': 'de',
                'german_switzerland': 'de', 'greek': 'el',
                'hebrew': 'he', 'hungarian': 'hu',
                'indonesian': 'id', 'italian': 'it',
                'japanese': 'ja', 'korean': 'ko',
                'korean_south_korea': 'ko', 'latvian': 'lv',
                'lithuanian': 'lt', 'malay': 'ms',
                'mandarin': 'zh', 'norwegian': 'no',
                'persian': 'fa', 'polish': 'pl',
                'portuguese': 'pt', 'romanian': 'ro',
                'russian': 'ru', 'spanish': 'es',
                'swahili': 'sw', 'swedish': 'sv',
                'thai': 'th', 'tibetan': 'bo',
                'turkish': 'tr', 'ukrainian': 'uk',
                'vietnamese': 'vi',
                # --- Africa ---
                'yoruba': 'yo', 'hausa': 'ha', 'igbo': 'ig',
                'amharic': 'am', 'afrikaans': 'af', 'zulu': 'zu',
                'xhosa': 'xh', 'tigrinya': 'ti', 'somali': 'so',
                'kinyarwanda': 'rw', 'shona': 'sn',
                # --- Southeast Asia ---
                'tagalog': 'tl', 'javanese': 'jw', 'cebuano': 'ceb',
                'khmer': 'km', 'lao': 'lo', 'sundanese': 'su',
                # --- Central Asia & Caucasus ---
                'uzbek': 'uz', 'kazakh': 'kk', 'azerbaijani': 'az',
                'georgian': 'ka', 'armenian': 'hy', 'mongolian': 'mn',
                'kyrgyz': 'ky', 'tajik': 'tg',
                # --- Middle East ---
                'kurdish': 'ku', 'pashto': 'ps',
                # --- Europe Regional ---
                'serbian': 'sr', 'croatian': 'hr', 'bosnian': 'bs',
                'slovak': 'sk', 'slovenian': 'sl', 'albanian': 'sq',
                'macedonian': 'mk', 'belarusian': 'be', 'welsh': 'cy',
                'irish': 'ga', 'basque': 'eu', 'galician': 'gl',
                'maltese': 'mt', 'icelandic': 'is',
            }

            is_indian_lang = target_language.lower() in sarvam_langs
            sarvam_api_key = os.environ.get("SARVAM_API_KEY")

            try:
                if is_indian_lang and sarvam_api_key:
                    # Assuming 'file_name' and 'logger' are available or can be mocked for this context
                    # For this specific change, we'll just add the print statements.
                    # If `logger` or `file_name` are not defined, this will cause an error.
                    # As per instructions, only add the print statement.
                    print("-" * 50)
                    print(f"[Transcribe] Using Sarvam API (saaras:v3) for {target_language} speech...")
                    print("-" * 50)
                    from sarvamai import SarvamAI # Assuming SarvamAI is the correct class
                    sarvam_client = SarvamAI(api_key=sarvam_api_key)
                    lang_code = sarvam_langs[target_language.lower()]
                    
                    with open(audio_p, "rb") as f:
                        response = sarvam_client.speech_to_text.transcribe(
                            file=f,
                            model="saaras:v3",
                            mode="transcribe",
                            language_code=lang_code,
                            request_options={"additional_body_parameters": {"with_timestamps": True}}
                        )
                    print(f"Sarvam API Transcription Success. Output type: {type(response)}")
                    
                    # Manual direct access/json parsing if response is object
                    # Fallback to internal dict if possible.
                    # We need to map sarvam words to dict {"word": "Hi", "start": 0.0, "end": 0.5}
                    
                    try:
                        # Normalize: convert response to dict first, then extract words
                        resp_data = response.dict() if hasattr(response, 'dict') else (
                            response if isinstance(response, dict) else {}
                        )

                        # Extract raw word list from either attribute or dict form
                        raw_sarvam_words = (
                            list(response.words) if hasattr(response, 'words') and response.words
                            else resp_data.get('words', [])
                        )

                        # Normalize each word: handle attribute-style objects and dicts
                        def _normalize_word(w):
                            if isinstance(w, dict):
                                return {
                                    "word": w.get('word') or w.get('text', ''),
                                    "start": float(w.get('start') or w.get('start_time') or 0),
                                    "end": float(w.get('end') or w.get('end_time') or 0),
                                }
                            return {
                                "word": getattr(w, 'word', None) or getattr(w, 'text', ''),
                                "start": float(getattr(w, 'start', None) or getattr(w, 'start_time', 0) or 0),
                                "end": float(getattr(w, 'end', None) or getattr(w, 'end_time', 0) or 0),
                            }

                        words = [_normalize_word(w) for w in raw_sarvam_words if w]
                        print(f"[Sarvam] Parsed {len(words)} words from response")
                        if words:
                            detected_language = target_language.lower()
                            language_confidence = 0.85
                    except Exception as parse_e:
                        print(f"Failed to parse Sarvam response: {parse_e}")
                        words = []
                else:
                    if not self.client:
                        raise Exception("No OpenAI Client")
                    whisper_lang = whisper_lang_codes.get(target_language.lower())
                    whisper_kwargs = {
                        "model": "whisper-1",
                        "response_format": "verbose_json",
                        "timestamp_granularities": ["word"],
                    }
                    if whisper_lang:
                        whisper_kwargs["language"] = whisper_lang
                    with open(audio_p, "rb") as f:
                        transcript = self.client.audio.transcriptions.create(
                            file=f,
                            **whisper_kwargs
                        )
                        detected_language = (getattr(transcript, "language", "") or detected_language).lower()
                        language_confidence = 0.92 if not whisper_lang else 0.75
                        raw_words = getattr(transcript, 'words', []) or []
                        # Normalize: handle both attribute-style objects and dicts
                        for w in raw_words:
                            if isinstance(w, dict):
                                words.append({
                                    "word": w.get('word', ''),
                                    "start": float(w.get('start') or 0),
                                    "end": float(w.get('end') or 0),
                                })
                            else:
                                words.append({
                                    "word": getattr(w, 'word', ''),
                                    "start": float(getattr(w, 'start', 0) or 0),
                                    "end": float(getattr(w, 'end', 0) or 0),
                                })
            except Exception as api_error:
                api_error_msg = str(api_error)
                print(f"[Warning] API Error: {api_error}. Using MOCK CAPTIONS for testing.")

            if not words and api_error_msg is None and self.client:
                try:
                    with open(audio_p, "rb") as f:
                        transcript = self.client.audio.transcriptions.create(
                            model="whisper-1",
                            file=f,
                            response_format="verbose_json",
                            timestamp_granularities=["word"],
                        )
                    detected_language = (getattr(transcript, "language", "") or detected_language).lower()
                    language_confidence = max(language_confidence, 0.55)
                    for w in (getattr(transcript, "words", []) or []):
                        if isinstance(w, dict):
                            words.append({
                                "word": w.get('word', ''),
                                "start": float(w.get('start') or 0),
                                "end": float(w.get('end') or 0),
                            })
                        else:
                            words.append({
                                "word": getattr(w, 'word', ''),
                                "start": float(getattr(w, 'start', 0) or 0),
                                "end": float(getattr(w, 'end', 0) or 0),
                            })
                except Exception as fallback_error:
                    api_error_msg = str(fallback_error)

            # Clean up temp file (file is now closed)
            try:
                if os.path.exists(audio_p):
                    os.remove(audio_p)
            except Exception:
                pass

            # If API failed, generate mock captions
            if api_error_msg is not None:
                # Get video duration for full-video mock captions
                try:
                    dur_result = subprocess.run(
                        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=nw=1:nk=1", input_p],
                        capture_output=True, text=True
                    )
                    video_duration = float(dur_result.stdout.strip())
                except Exception:
                    video_duration = 16.8  # fallback

                # Generate realistic word-level mock data spanning entire video
                mock_sentences = [
                    ["This", "is", "a", "caption", "test."],
                    ["Checking", "highlight", "colors."],
                    ["Background", "thickness", "should", "work."],
                    ["Dynamic", "pacing"],
                    ["adapts", "to", "the", "speed", "of"],
                    ["speech."],
                    ["Fast", "words", "group", "together", "naturally."],
                    ["Slow"],
                    ["dramatic."],
                    ["One", "two", "three."],
                    ["Export", "this", "video."],
                    ["Verify", "timing."],
                    ["Captions", "match", "audio."],
                    ["Perfect", "sync."],
                    ["Every", "word", "counts."],
                ]

                # Distribute sentences across video duration
                all_words = []
                cursor = 0.2  # small initial offset
                sentence_idx = 0
                while cursor < video_duration - 0.5:
                    sentence = mock_sentences[sentence_idx % len(mock_sentences)]
                    for word in sentence:
                        word_dur = 0.25 + len(word) * 0.04
                        if cursor + word_dur > video_duration:
                            break
                        all_words.append({"word": word, "start": round(cursor, 3), "end": round(cursor + word_dur, 3)})
                        cursor += word_dur + 0.05
                    cursor += 0.3
                    sentence_idx += 1

                grouped = self._group_words_by_speech_pace(all_words, min_words=min_words, max_words=max_words)
                grouped = self._post_process_captions(grouped)
                return {
                    "success": True,
                    "captions": grouped,
                    "detected_language": detected_language,
                    "language_confidence": 0.35,
                    "transcription_source": "mock_fallback",
                }

            grouped_captions = self._group_words_by_speech_pace(words, min_words=min_words, max_words=max_words)
            grouped_captions = self._post_process_captions(grouped_captions)
            return {
                "success": True,
                "captions": grouped_captions,
                "detected_language": detected_language,
                "language_confidence": round(max(0.0, min(1.0, language_confidence)), 2),
                "transcription_source": "sarvam" if is_indian_lang and sarvam_api_key else "whisper",
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error: {e}")
            return {"success": False, "error": str(e)}

    async def burn_only(self, input_p, output_p, captions, style, word_layouts=None):
        with open("backend_debug.log", "w", encoding="utf-8") as _logf:
            _logf.write(f"BURNING with style: {json.dumps(style, indent=2)}\n")
            _logf.write(f"DEBUG: Found {len(captions)} captions, and {len(word_layouts) if word_layouts else 0} word layouts\n")
            _logf.write(f"CAPTIONS DATA: {json.dumps(captions, indent=2)}\n")
            if word_layouts:
                _logf.write(f"WORD LAYOUTS DATA: {json.dumps(word_layouts, indent=2)}\n")
            
        print(f"BURNING with style: {json.dumps(style, indent=2)}")
        print(f"DEBUG: Found {len(captions)} captions, and {len(word_layouts) if word_layouts else 0} word layouts")
        try:
            font_key = style.get('font_family', 'Inter')
            font_info = self._ensure_font(font_key)

            video_w, video_h = self._get_video_dimensions(input_p)
            print(f"Original Video dimensions: {video_w}x{video_h}")
            
            crop_filter = ""
            # Auto-Reframe: If horizontal (wider than tall), crop center to 9:16
            if video_w > video_h:
                new_w = int(video_h * 9 / 16)
                if new_w % 2 != 0: new_w -= 1 # Ensure even number for encoders
                crop_filter = f"crop={new_w}:{video_h},"
                print(f"[Reframe] Auto-reframing horizontal video to vertical: {new_w}x{video_h}")
                video_w = new_w # Update subtitle canvas width to match new cropped width

            # Templates are rendered with the same browser DOM/CSS pipeline as the app preview.
            if self._should_use_dom_template_renderer(style):
                return self._render_dom_template_overlay(
                    input_p=input_p,
                    output_p=output_p,
                    captions=captions,
                    style=style,
                    video_w=video_w,
                    video_h=video_h,
                    crop_filter=crop_filter.rstrip(','),
                )

            ass_path = self._create_styled_ass(captions, style, font_info, video_w, video_h, word_layouts)

            # FFmpeg on Windows: 1) drive letters break filter parsing, 2) backslashes are escape chars
            # Solution: relative paths + forward slashes for everything
            try:
                ass_rel = os.path.relpath(ass_path).replace('\\', '/')
                fonts_rel = os.path.relpath(self.fonts_dir).replace('\\', '/')
            except ValueError:
                ass_rel = ass_path.replace('\\', '/')
                fonts_rel = self.fonts_dir.replace('\\', '/')

            # Forward slashes for input/output too
            input_fwd = input_p.replace('\\', '/')
            output_fwd = output_p.replace('\\', '/')

            # Quality settings — always scale by width (scale=W:-2 keeps aspect, ensures even height)
            # After the crop step, horizontal videos are already converted to vertical (9:16),
            # so scaling by width works uniformly for all orientations.
            quality = style.get('quality', '1080p')
            fps = self._get_export_fps(style)
            if quality == '4k':
                scale_filter = "scale=2160:-2:flags=lanczos"
                crf = "18"
                audio_bitrate = "192k"
            elif quality == '720p':
                scale_filter = "scale=720:-2:flags=lanczos"
                crf = "26"
                audio_bitrate = "128k"
            else:  # 1080p default
                scale_filter = "scale=1080:-2:flags=lanczos"
                crf = "22"
                audio_bitrate = "128k"

            # Filter chain: crop → ass → scale
            # ass must come before scale so ASS PlayRes coords match the pre-scale frame dimensions.
            ass_filter = f"ass={ass_rel}:fontsdir={fonts_rel}"
            vf_parts = [p for p in [crop_filter.rstrip(','), ass_filter, scale_filter] if p]
            vf_filter = ",".join(vf_parts)
            print(f"[FFmpeg] Quality: {quality}, CRF: {crf}")
            print(f"[FFmpeg] -vf filter: {vf_filter}")
            print(f"[FFmpeg] Input: {input_fwd}")
            print(f"[FFmpeg] Output: {output_fwd}")

            cmd = [
                "ffmpeg", "-y", "-i", input_fwd,
                "-vf", vf_filter,
                "-map", "0:v:0", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "fast", "-crf", crf,
                "-r", str(fps),
                "-c:a", "aac", "-b:a", audio_bitrate,
                "-shortest",
                output_fwd
            ]

            # Save a debug copy of the ASS file BEFORE running FFmpeg
            debug_ass_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "last_export_debug.ass")
            try:
                import shutil
                shutil.copy2(ass_path, debug_ass_path)
                print(f"[Debug] ASS file saved to: {debug_ass_path}")
                # Count Dialogue lines for quick sanity check
                with open(ass_path, "r", encoding="utf-8") as _df:
                    _lines = _df.readlines()
                    _dialogue_count = sum(1 for l in _lines if l.startswith("Dialogue:"))
                    print(f"[Debug] ASS file: {len(_lines)} total lines, {_dialogue_count} Dialogue lines")
                    # Print first 3 Dialogue lines as sample
                    _sample = [l.strip() for l in _lines if l.startswith("Dialogue:")][:3]
                    for _s in _sample:
                        print(f"[Debug] Sample: {_s[:200]}")
            except Exception as _de:
                print(f"[Debug] Could not save debug ASS: {_de}")

            print(f"[FFmpeg] Running command: {' '.join(cmd)}")
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: subprocess.run(cmd, capture_output=True, text=True)
            )

            # Always log FFmpeg stderr (even on success — libass warnings appear here)
            if result.stderr:
                print(f"[FFmpeg] stderr (last 1000 chars): {result.stderr[-1000:]}")

            if result.returncode != 0:
                return {"success": False, "error": f"FFmpeg failed: {result.stderr[-500:]}"}

            # Verify output file exists and has size
            if os.path.exists(output_fwd.replace('/', os.sep)):
                out_size = os.path.getsize(output_fwd.replace('/', os.sep))
                print(f"[FFmpeg] Output file size: {out_size} bytes")
            else:
                print(f"[FFmpeg] WARNING: Output file not found at {output_fwd}")

            if os.path.exists(ass_path):
                os.remove(ass_path)
            return {"success": True}

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def _should_use_dom_template_renderer(self, style):
        template_id = str(style.get('template_id') or '').strip()
        return bool(template_id)

    def _get_video_duration(self, video_path):
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", video_path
                ],
                capture_output=True, text=True, check=True
            )
            return max(float((result.stdout or "0").strip() or 0), 0.01)
        except Exception:
            return 1.0

    def _get_quality_settings(self, quality):
        if quality == '4k':
            return "scale=2160:-2:flags=lanczos", "18", "192k"
        if quality == '720p':
            return "scale=720:-2:flags=lanczos", "26", "128k"
        return "scale=1080:-2:flags=lanczos", "22", "128k"

    def _get_export_fps(self, style):
        try:
            fps = int(style.get('fps', 30) or 30)
        except (TypeError, ValueError):
            fps = 30
        return fps if fps in {24, 30, 60} else 30

    def _render_dom_template_overlay(self, input_p, output_p, captions, style, video_w, video_h, crop_filter=""):
        quality = style.get('quality', '1080p')
        scale_filter, crf, audio_bitrate = self._get_quality_settings(quality)
        fps = self._get_export_fps(style)
        duration = self._get_video_duration(input_p)
        temp_root = os.path.join(self.project_root, ".render_tmp")
        os.makedirs(temp_root, exist_ok=True)
        temp_dir = os.path.join(temp_root, f"caption-template-overlay-{uuid.uuid4().hex}")
        os.makedirs(temp_dir, exist_ok=True)
        try:
            payload_path = os.path.join(temp_dir, "payload.json")
            overlay_dir = os.path.join(temp_dir, "overlay_frames")
            overlay_mov = os.path.join(temp_dir, "overlay.mov")
            os.makedirs(overlay_dir, exist_ok=True)

            payload = {
                "captions": captions,
                "style": style,
                "video_width": video_w,
                "video_height": video_h,
                "duration": duration,
                "output_dir": overlay_dir,
            }
            with open(payload_path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)

            render_cmd = ["node", self.template_overlay_script, payload_path]
            print(f"[Template DOM] Rendering overlay frames with: {' '.join(render_cmd)}")
            render_result = subprocess.run(
                render_cmd,
                capture_output=True,
                text=True,
                cwd=self.project_root,
            )
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

            concat_cmd = [
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0",
                "-i", frames_txt,
                "-vsync", "vfr",
                "-c:v", "qtrle",
                "-pix_fmt", "argb",
                overlay_mov,
            ]
            print(f"[Template DOM] Building overlay video: {' '.join(concat_cmd)}")
            concat_result = subprocess.run(concat_cmd, capture_output=True, text=True)
            if concat_result.stderr:
                print(f"[Template DOM] concat stderr (last 1000 chars): {concat_result.stderr[-1000:]}")
            if concat_result.returncode != 0:
                return {"success": False, "error": f"Overlay video build failed: {concat_result.stderr[-500:]}"}

            base_chain = "[0:v]"
            if crop_filter:
                base_chain += f"{crop_filter},"
            base_chain += "format=rgba[base]"
            filter_complex = f"{base_chain};[base][1:v]overlay=0:0:format=auto[composited];[composited]{scale_filter},format=yuv420p[outv]"

            cmd = [
                "ffmpeg", "-y",
                "-i", input_p.replace('\\', '/'),
                "-i", overlay_mov.replace('\\', '/'),
                "-filter_complex", filter_complex,
                "-map", "[outv]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", crf,
                "-r", str(fps),
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                "-shortest",
                output_p.replace('\\', '/'),
            ]

            print(f"[Template DOM] Quality: {quality}, CRF: {crf}")
            print(f"[Template DOM] filter_complex: {filter_complex}")
            print(f"[Template DOM] Running FFmpeg: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.stderr:
                print(f"[Template DOM] FFmpeg stderr (last 1000 chars): {result.stderr[-1000:]}")
            if result.returncode != 0:
                return {"success": False, "error": f"FFmpeg failed: {result.stderr[-500:]}"}

            if os.path.exists(output_p):
                print(f"[Template DOM] Output file size: {os.path.getsize(output_p)} bytes")
            return {"success": True}
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def _get_video_dimensions(self, video_path):
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height",
                 "-of", "json", video_path],
                capture_output=True, text=True
            )
            data = json.loads(result.stdout)
            w = data['streams'][0]['width']
            h = data['streams'][0]['height']

            rotation = self._get_rotation(video_path)
            if rotation in (90, -90, 270, -270):
                w, h = h, w
                print(f"Video is rotated {rotation}°, swapping dimensions to {w}x{h}")

            return w, h
        except Exception:
            return 1080, 1920

    def _get_rotation(self, video_path):
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream_side_data=rotation",
                 "-of", "json", video_path],
                capture_output=True, text=True
            )
            data = json.loads(result.stdout)
            for stream in data.get('streams', []):
                for sd in stream.get('side_data_list', []):
                    rot = sd.get('rotation')
                    if rot is not None:
                        return int(rot)

            result2 = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream_tags=rotate",
                 "-of", "default=nw=1:nk=1", video_path],
                capture_output=True, text=True
            )
            rot_str = result2.stdout.strip()
            if rot_str:
                return int(rot_str)
        except Exception:
            pass
        return 0

    def _group_words_by_speech_pace(self, words, min_words=0, max_words=0):
        """
        Dynamic word-level grouping based on local speech rate.
        - Slow speech (WPS < 2): 1 word per caption (punchy)
        - Normal speech (WPS 2-4): 1-3 words per caption
        - Fast speech (WPS > 4): 3-5 words grouped as phrase
        Uses exact Whisper timestamps for millisecond accuracy.
        """
        if not words:
            return []

        # --- Step 1: Normalize word data ---
        parsed = []
        for w in words:
            text = (w.get('word', '') if isinstance(w, dict) else getattr(w, 'word', '')).strip()
            start = float(w.get('start', 0) if isinstance(w, dict) else getattr(w, 'start', 0))
            end = float(w.get('end', 0) if isinstance(w, dict) else getattr(w, 'end', 0))
            if text and end > start:
                parsed.append({"word": text, "start": start, "end": end})

        if not parsed:
            return []

        # --- Step 2: Calculate local speech rate for each word ---
        def _local_wps(idx, window=3):
            """Words-per-second in a local window around idx."""
            lo = max(0, idx - window)
            hi = min(len(parsed) - 1, idx + window)
            span = parsed[hi]['end'] - parsed[lo]['start']
            count = hi - lo + 1
            if span <= 0:
                return 3.0  # default normal
            return count / span

        # --- Step 3: Group words dynamically ---
        captions = []
        current_group = []
        caption_id = 0
        SILENCE_GAP = 0.3       # seconds of silence → force break
        PUNCTUATION = set('.!?')  # sentence-ending punctuation → force break

        for i, word in enumerate(parsed):
            current_group.append(word)
            word_count = len(current_group)

            # Determine if we should break after this word
            should_break = False

            # Rule 0: Last word → always break
            if i == len(parsed) - 1:
                should_break = True
            else:
                next_word = parsed[i + 1]
                gap = next_word['start'] - word['end']
                group_dur = word['end'] - current_group[0]['start']
                local_rate = _local_wps(i)

                # Rule 1: Silence gap → always break
                if gap >= SILENCE_GAP:
                    should_break = True

                # Rule 2: Punctuation at end of word → break
                elif word['word'][-1] in PUNCTUATION:
                    should_break = True

                # Rule 3: Hard cap at max_words (default 5)
                elif word_count >= (max_words if max_words > 0 else 5):
                    should_break = True

                # Rule 4: Speech-rate-based dynamic sizing
                elif local_rate < 2.0:
                    # SLOW speech - use min_words (punchy/dramatic)
                    lo = min_words if min_words > 0 else 1
                    if word_count >= lo:
                        should_break = True

                elif local_rate <= 4.0:
                    # NORMAL speech - use max_words as target
                    hi = max_words if max_words > 0 else 3
                    if word_count >= hi:
                        should_break = True
                    elif word_count >= (min_words if min_words > 0 else 2) and gap > 0.15:
                        should_break = True
                    elif word_count >= (min_words if min_words > 0 else 2) and group_dur > 0.8:
                        should_break = True

                else:
                    # FAST speech (> 4 WPS) - allow up to max_words as a phrase
                    hi = max_words if max_words > 0 else 5
                    lo = min_words if min_words > 0 else 3
                    if word_count >= hi and gap > 0.1:
                        should_break = True
                    elif word_count >= lo and gap > 0.2:
                        should_break = True

            # --- Emit caption group ---
            if should_break and current_group:
                text = " ".join(item['word'] for item in current_group)
                intentional_single_word = len(current_group) == 1 and _local_wps(i) < 2.0
                captions.append({
                    "id": caption_id,
                    "text": text,
                    "start_time": current_group[0]['start'],
                    "end_time": current_group[-1]['end'],
                    "intentional_single_word": intentional_single_word,
                    "words": [
                        {"word": item['word'], "start": item['start'], "end": item['end']}
                        for item in current_group
                    ]
                })
                caption_id += 1
                current_group = []

        # Close gaps: extend each caption's end_time to the next caption's start_time
        for i in range(len(captions) - 1):
            captions[i]['end_time'] = captions[i + 1]['start_time']

        print(f"[Captions] Generated {len(captions)} captions (min_words={min_words}, max_words={max_words})")
        return captions

    def _normalize_caption_text(self, text):
        t = " ".join((text or "").strip().split())
        if not t:
            return t
        t = re.sub(r"\s+([,.!?;:])", r"\1", t)
        if len(t) > 8 and not re.search(r"[.!?]$", t):
            t = f"{t}."
        return t

    def _post_process_captions(self, captions):
        if not captions:
            return []

        normalized = []
        for cap in captions:
            c = dict(cap)
            c["text"] = self._normalize_caption_text(c.get("text", ""))
            c["start_time"] = float(c.get("start_time", 0) or 0)
            c["end_time"] = float(c.get("end_time", 0) or 0)
            if c["end_time"] <= c["start_time"]:
                c["end_time"] = c["start_time"] + 0.35
            normalized.append(c)

        merged = []
        i = 0
        while i < len(normalized):
            cur = normalized[i]
            cur_dur = cur["end_time"] - cur["start_time"]
            word_count = len((cur.get("text") or "").split())
            tiny = not cur.get("intentional_single_word") and (cur_dur < 0.35 and word_count <= 2)
            if tiny and i + 1 < len(normalized):
                nxt = dict(normalized[i + 1])
                nxt["text"] = self._normalize_caption_text(f"{cur.get('text', '')} {nxt.get('text', '')}")
                nxt["start_time"] = min(cur["start_time"], nxt.get("start_time", cur["start_time"]))
                words = list(cur.get("words") or []) + list(nxt.get("words") or [])
                if words:
                    nxt["words"] = sorted(words, key=lambda item: float(item.get("start", 0) or 0))
                merged.append(nxt)
                i += 2
                continue
            merged.append(cur)
            i += 1

        # Reading speed guard: avoid extremely dense captions.
        for idx, cap in enumerate(merged):
            dur = max(0.2, cap["end_time"] - cap["start_time"])
            cps = len(cap.get("text", "")) / dur
            if cps > 24:
                cap["end_time"] = cap["start_time"] + (len(cap.get("text", "")) / 22.0)
            if idx < len(merged) - 1:
                next_start = merged[idx + 1]["start_time"]
                cap["end_time"] = min(cap["end_time"], next_start)
            cap["id"] = idx

        return merged

    def _create_styled_ass(self, captions, style, font_info, video_w, video_h, word_layouts=None):
        """
        Generate an ASS subtitle file for FFmpeg burning.

        PRIMARY PATH (when template_id + word_layouts available):
          Each word is rendered as an independent Dialogue line at its DOM-captured position.
          Gives pixel-accurate positioning and per-word effects matching the CSS preview.

        FALLBACK PATH (no template or no word_layouts):
          Position-based with inline per-word style overrides (legacy behaviour).
        """
        import uuid as _uuid
        ass_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"_tmp_{_uuid.uuid4().hex[:8]}.ass")

        # ── Scale factor: preview coords → video coords ────────────────────
        base_size = int(style.get('font_size', 18))
        preview_h = float(style.get('preview_height', 400))
        if preview_h < 50:
            preview_h = 400
        scale_factor = video_h / preview_h
        scaled_size = max(int(base_size * scale_factor), 20)

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
        print(f"[ASS] font={font_name!r} size={scaled_size} scale_factor={scale_factor:.2f}")

        # ── Script detection + Indic font override ────────────────────────
        all_text = " ".join(c.get('text', '') for c in captions)
        detected_script = self._detect_script(all_text)
        if detected_script:
            indic_font_info = self._ensure_indic_font(detected_script)
            # Fonts known to include Indic Unicode ranges — keep as-is
            _indic_safe = {
                'noto sans', 'noto sans devanagari', 'mukta', 'baloo 2',
                'hind', 'hind siliguri', 'hind guntur', 'hind madurai',
                'hind vadodara', 'hind mysuru',
                'noto sans bengali', 'noto sans telugu', 'noto sans tamil',
                'noto sans gujarati', 'noto sans kannada', 'noto sans malayalam',
                'noto sans oriya', 'noto sans arabic',
                'mukta malar', 'mukta mahee', 'mukta vaani',
                'rajdhani', 'kalam', 'tiro devanagari hindi',
                'catamaran', 'arima', 'atma', 'galada',
            }
            if indic_font_info and font_name.lower() not in _indic_safe:
                print(f"[ASS] Font '{font_name}' is Latin-only; overriding to {indic_font_info['ass_name']} for {detected_script}")
                font_name = indic_font_info['ass_name']
        INDIC_Y_CORR = {
            'devanagari': -0.025, 'bengali': -0.020, 'gujarati': -0.020,
            'punjabi': -0.015, 'tamil': -0.015, 'telugu': -0.015,
            'kannada': -0.015, 'malayalam': -0.015, 'odia': -0.015, 'arabic': -0.010,
        }
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
        primary_hex = style.get('text_color', '#FFFFFF') or '#FFFFFF'
        primary_ass = self._hex_to_ass(primary_hex, float(style.get('text_opacity', 1.0) or 1.0))
        has_bg = bool(style.get('has_background', False))
        bg_hex = style.get('background_color', '#000000') or '#000000'
        bg_opacity = float(style.get('background_opacity', 0.7) or 0.7)
        bg_ass = self._hex_to_ass(bg_hex, bg_opacity)
        bg_padding = float(style.get('background_padding', 6) or 6)
        bg_h_mult = float(style.get('background_h_multiplier', 0.99) or 0.99)
        has_stroke = bool(style.get('has_stroke', False))
        stroke_color_hex = style.get('stroke_color', '#000000') or '#000000'
        stroke_width_v = float(style.get('stroke_width', 1) or 1)
        has_shadow_v = bool(style.get('has_shadow', False))
        shadow_color_hex = style.get('shadow_color', '#000000') or '#000000'
        shadow_blur_v = float(style.get('shadow_blur', 4) or 4)
        shadow_ox_v = float(style.get('shadow_offset_x', 0) or 0)
        shadow_oy_v = float(style.get('shadow_offset_y', 2) or 2)
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
            'offset': float(style.get('effect_offset', 50) or 50),
            'direction': float(style.get('effect_direction', -45) or -45),
            'blur': float(style.get('effect_blur', 50) or 50),
            'transparency': float(style.get('effect_transparency', 40) or 40),
            'thickness': float(style.get('effect_thickness', 50) or 50),
            'intensity': float(style.get('effect_intensity', 50) or 50),
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
        pos_y = int((float(style.get('position_y', 75) or 75) / 100) * video_h)
        if detected_script in INDIC_Y_CORR:
            pos_y = max(10, pos_y + int(INDIC_Y_CORR[detected_script] * video_h))

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
                raw_text = c.get('text', '')
                if not raw_text.strip(): continue
                s = self._fmt(st)
                e = self._fmt(et)
                cid = str(c.get('id', ''))
                anim = (c.get('animation', 'none') or 'none')
                ws_map = c.get('word_styles') or {}
                if not isinstance(ws_map, dict): ws_map = {}
                words_timing = c.get('words') or []
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
                    if isinstance(_pos_ws, dict) and _pos_ws.get('abs_x_pct') is not None:
                        positioned.append((_pos_wi, _pos_tok, _pos_ws))
                    _pos_wi += 1

                # ─── TEXT ELEMENT ─────────────────────────────────────────
                if is_te:
                    cs = c.get('custom_style') or {}
                    te_fi = self._ensure_font(cs.get('font_family', 'Inter') or 'Inter')
                    te_fn = te_fi['ass_name']
                    te_fs = max(int(int(cs.get('font_size', 18) or 18) * scale_factor), 20)
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
                    if detected_script in INDIC_Y_CORR:
                        te_py = max(10, te_py + int(INDIC_Y_CORR[detected_script] * video_h))
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
                        if ax2 is not None and ay2 is not None:
                            te_sep.append((wi2, tok2, wsv2))
                        else:
                            ov2 = []; rv2 = []
                            if wsv2.get('color'):
                                ov2.append(f"\\1c{self._hex_to_ass(wsv2['color'])}"); rv2.append(f"\\1c{te_c}")
                            if wsv2.get('fontFamily'):
                                wfi2 = self._ensure_font(wsv2['fontFamily'])
                                ov2.append(f"\\fn{wfi2['ass_name']}"); rv2.append(f"\\fn{te_fn}")
                            if wsv2.get('fontSize'):
                                ov2.append(f"\\fs{max(int(float(wsv2['fontSize'])*scale_factor),20)}"); rv2.append(f"\\fs{te_fs}")
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
                        wfs3 = max(int(float(wsv3['fontSize'])*scale_factor), 20) if wsv3.get('fontSize') else te_fs
                        pt3 = [f"\\fn{wfn3}", f"\\fs{wfs3}", f"\\1c{wc3}", f"\\an{te_align}", te_style_str, f"\\pos({wx3},{wy3})"]
                        if te_bold: pt3.append("\\b1")
                        if te_italic: pt3.append("\\i1")
                        f.write(f"Dialogue: 1,{s},{e},Default,,0,0,0,,{{{''.join(pt3)}}}{tok3}\n")
                    continue

                # ─── PRIMARY: WORD-LAYOUT TEMPLATE PATH ───────────────────
                # Uses DOM-captured word positions (word_layouts) for per-word rendering.
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
                    _CEFF = {
                        't-115': f'\\bord0\\shad6\\blur5\\4c{_gn(secondary_hex or "#39FF14")}',
                        't-109': f'\\bord0\\shad4\\xshad{max(int(3*scale_factor),1)}\\yshad{max(int(3*scale_factor),1)}\\4c{_gn(secondary_hex or "#E01A1A")}',
                        't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn(shadow_color_hex if has_shadow_v else "#ff4500")}',
                        't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn(shadow_color_hex if has_shadow_v else "#cc0000")}',
                        't-57':  f'\\bord0\\shad0\\xshad{max(int(2*scale_factor),1)}\\yshad0\\4c{_gn(shadow_color_hex if has_shadow_v else "#00ffff")}',
                        't-56':  '\\u1\\bord0\\shad0',
                        't-T3':  '\\u1\\bord0\\shad0',
                        't-124': f'\\bord0\\shad4\\xshad{max(int(4*scale_factor),1)}\\yshad{max(int(4*scale_factor),1)}\\blur0\\4c{_gn(shadow_color_hex if has_shadow_v else "#ffffff")}',
                        't-104': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn(secondary_hex or "#B28DFF",1.0)}\\shad0',
                        't-110': f'\\bord0\\shad{max(int(4*scale_factor),2)}\\blur3\\4c{_gn(secondary_hex or "#0066FF")}',
                        't-105': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn(stroke_color_hex,1.0)}\\shad{max(int(shadow_blur_v*scale_factor*0.4),1)}\\4c{_gn(shadow_color_hex,1.0)}\\blur2',
                    }
                    _cur_eff = _CEFF.get(template_id, '\\bord0\\shad0')

                    # Templates where active/current word text uses secondary color
                    _ACT_SEC = {'t-36', 't-37'}
                    _CUR_SEC = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}

                    _pa = float(style.get('text_opacity', 1.0) or 1.0)
                    _act_c   = _gn(secondary_hex if (secondary_hex and template_id in _ACT_SEC) else primary_hex, _aa * _pa)
                    _inact_c = _gn(primary_hex, _ia * _pa)
                    _cur_c   = _gn(secondary_hex if (secondary_hex and template_id in _CUR_SEC) else primary_hex, 1.0)

                    _cur_box_bg  = _gn(secondary_hex or '#FFE600', 1.0)
                    _base_box_bg = _gn(bg_hex, bg_opacity)

                    # Base tags shared by every word line (no position/color — added per word)
                    _bt = f'\\fn{font_name}\\fs{scaled_size}\\an5'
                    if bold_flag:      _bt += '\\b1'
                    if italic_flag:    _bt += '\\i1'
                    if letter_spacing: _bt += f'\\fsp{letter_spacing}'

                    # Suppressor: hides outline/shadow/box from Default style (BoxStyle=1 or 3)
                    _nobox = '\\bord0\\shad0\\3a&HFF&\\4a&HFF&'

                    def _wxy(lyt):
                        _wx = int((float(lyt['x']) / 100) * video_w)
                        _wy = int((float(lyt['y']) / 100) * video_h)
                        if detected_script in INDIC_Y_CORR:
                            _wy = max(10, _wy + int(INDIC_Y_CORR[detected_script] * video_h))
                        return _wx, _wy

                    _aw = [_T((wt2.get('word') or '').strip()) for wt2 in words_timing]

                    # Gap before first word — write all inactive words
                    _fts = float(words_timing[0].get('start', st)) if words_timing else st
                    if _fts > st + 0.05 and _ia > 0.0:
                        for _wi2, _wd2 in enumerate(_aw):
                            if not _wd2: continue
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
                        _wsc = ws_map.get(f"{cid}-{_wi}", {})
                        if isinstance(_wsc, dict) and _wsc.get('abs_x_pct') is not None:
                            continue  # Separately positioned — rendered below
                        _ws2 = float(_wt2.get('start', st))
                        _we2 = float(words_timing[_wi + 1].get('start', et) if _wi + 1 < len(words_timing) else et)
                        if _we2 <= _ws2: _we2 = _ws2 + 0.05
                        _ts_s = self._fmt(_ws2)
                        _ts_e = self._fmt(_we2)

                        for _wi2, _wd2 in enumerate(_aw):
                            if not _wd2: continue
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
                                    _lt = f'{_bt}\\1c{_act_c}{_nobox}{_pt}'
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
                        _wfs_p = max(int(float(_ws_p['fontSize']) * scale_factor), 20) if _ws_p.get('fontSize') else scaled_size
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
                    if ax is not None and ay is not None:
                        positioned.append((word_idx, tok, ws))
                    else:
                        ov = []; rv = []
                        if ws.get('color'):
                            ov.append(f"\\1c{self._hex_to_ass(ws['color'])}"); rv.append(f"\\1c{primary_ass}")
                        if ws.get('fontFamily'):
                            wfi = self._ensure_font(ws['fontFamily'])
                            ov.append(f"\\fn{wfi['ass_name']}"); rv.append(f"\\fn{font_name}")
                        if ws.get('fontSize'):
                            ov.append(f"\\fs{max(int(float(ws['fontSize'])*scale_factor),20)}"); rv.append(f"\\fs{scaled_size}")
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

                    # Color logic matching the primary word-layout path
                    _ACT_SEC_FB = {'t-36', 't-37'}
                    _CUR_SEC_FB = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}
                    _act_c_fb  = _gn_fb(secondary_hex if (secondary_hex and template_id in _ACT_SEC_FB) else primary_hex, _aa_fb * _pa_fb)
                    _inact_c_fb = _gn_fb(primary_hex, _ia_fb * _pa_fb)
                    _cur_c_fb  = _gn_fb(secondary_hex if (secondary_hex and template_id in _CUR_SEC_FB) else primary_hex, 1.0)

                    all_tpl_words = [_T((wt.get('word') or '').strip()) for wt in words_timing]

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
                        't-109': f'\\bord0\\shad4\\xshad{max(int(3*scale_factor),1)}\\yshad{max(int(3*scale_factor),1)}\\4c{_gn_fb(secondary_hex or "#E01A1A")}',
                        't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#ff4500")}',
                        't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#cc0000")}',
                        't-57':  f'\\bord0\\shad0\\xshad{max(int(2*scale_factor),1)}\\yshad0\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#00ffff")}',
                        't-56':  '\\u1\\bord0\\shad0',
                        't-T3':  '\\u1\\bord0\\shad0',
                        't-124': f'\\bord0\\shad4\\xshad{max(int(4*scale_factor),1)}\\yshad{max(int(4*scale_factor),1)}\\blur0\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#ffffff")}',
                        't-104': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn_fb(secondary_hex or "#B28DFF",1.0)}\\shad0',
                        't-110': f'\\bord0\\shad{max(int(4*scale_factor),2)}\\blur3\\4c{_gn_fb(secondary_hex or "#0066FF")}',
                        't-105': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn_fb(stroke_color_hex,1.0)}\\shad{max(int(shadow_blur_v*scale_factor*0.4),1)}\\4c{_gn_fb(shadow_color_hex,1.0)}\\blur2',
                    }
                    _cur_eff_fb = _CEFF_FB.get(template_id, '\\bord0\\shad0')
                    # Suppress effects for non-current words (no glow/shadow bleed)
                    _noeff_fb = '\\bord0\\shad0\\blur0'

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
                                    parts.append(f"{{\\1c{_act_c_fb}{_noeff_fb}}}{tw}")
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
                        ws_chk = ws_map.get(f"{cid}-{wi}", {})
                        if isinstance(ws_chk, dict) and ws_chk.get('abs_x_pct') is not None: continue
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
                            if ws2.get('abs_x_pct') is not None: continue
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
                                w_tags.insert(1, f"\\fs{max(int(float(ws2['fontSize'])*scale_factor),20)}")
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
                    wfs4 = max(int(float(ws4['fontSize'])*scale_factor), 20) if ws4.get('fontSize') else scaled_size
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
                    all_ww = [_T(wt.get('word', '').strip()) for wt in words_timing if wt.get('word', '').strip()]
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
                        if ws5.get('isEmphasis') or ws5.get('abs_x_pct') is not None: continue
                        parts_h = []
                        for j, tw in enumerate(all_ww):
                            if j == wi:
                                parts_h.append(f"{{\\1c{h_ass}\\3c{h_ass}\\4c{h_ass}\\bord{h_bord}\\shad0}}{tw}")
                            else:
                                parts_h.append(f"{{\\1c{primary_ass}\\3c{outline_c}\\4c{back_c}\\bord{outline_size}\\shad{shadow_size}}}{tw}")
                        h_str = "{" + "".join(h_base) + "}" + " ".join(parts_h)
                        f.write(f"Dialogue: 2,{self._fmt(w_st2)},{self._fmt(w_et2)},Default,,0,0,0,,{h_str}\n")

        # Debug: log sample Dialogue lines
        try:
            with open(ass_path, 'r', encoding='utf-8') as _df:
                _lines = _df.readlines()
                _diags = [l.strip() for l in _lines if l.startswith('Dialogue:')]
                print(f"[ASS] Created: {len(_lines)} lines, {len(_diags)} Dialogue entries")
                for dl in _diags[:4]:
                    print(f"[ASS]   {dl[:200]}")
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
