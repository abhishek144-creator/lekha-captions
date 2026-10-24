// Google Fonts axes for the families that template designs use at more than
// the regular weight. A bare `family=Name` request returns only weight 400, so
// the export would fake bold and could not draw light or italic faces at all.
// Each spec was checked against fonts.googleapis.com/css2 (an unknown weight
// fails the whole request). Families not listed keep the bare request.
export const RENDER_FONT_AXES = Object.freeze({
  'cinzel': 'wght@400..900',
  'cormorant garamond': 'ital,wght@0,300..700;1,300..700',
  'inter': 'ital,wght@0,100..900;1,100..900',
  'josefin sans': 'wght@100..700',
  'lato': 'wght@100;300;400;700;900',
  'libre baskerville': 'ital,wght@0,400;0,700;1,400',
  'mulish': 'wght@200..1000',
  // Devanagari fallback for every template (static family: a weight list, not a range).
  'mukta': 'wght@200;300;400;500;600;700;800',
  'nunito': 'wght@200..1000',
  'open sans': 'wght@300..800',
  'oswald': 'wght@200..700',
  'playfair display': 'ital,wght@0,400..900;1,400..900',
  // Hindi caption default and the Devanagari face of many templates: static
  // families, so a weight list (a range fails the request).
  'poppins': 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700',
  'raleway': 'ital,wght@0,100..900;1,100..900',
  'rajdhani': 'wght@300;400;500;600;700',
  'space grotesk': 'wght@300..700',
  'tiro devanagari hindi': 'ital@0;1',
  'work sans': 'wght@100..900',
  // Picks set (lekha-captions-lc-picks.html)
  'sora': 'wght@100..800',
  'instrument serif': 'ital@0;1',
  'ibm plex mono': 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,400',
  'space mono': 'ital,wght@0,400;0,700;1,400;1,700',
  'syne': 'wght@400..800',
});

// One `family=` query parameter for the Google Fonts css2 API.
export function googleFontFamilyParam(family) {
  const name = String(family || '').trim();
  const axes = RENDER_FONT_AXES[name.toLowerCase()];
  const encoded = encodeURIComponent(name).replace(/%20/g, '+');
  return `family=${encoded}${axes ? `:${axes}` : ''}`;
}
