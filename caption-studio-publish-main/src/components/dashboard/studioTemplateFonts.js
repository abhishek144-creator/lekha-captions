// Fonts for the Studio set (lekha-captions-lc-studio.html) and the Picks set
// (lekha-captions-lc-picks.html). The gallery cards and the editor canvas load
// the same request so a template looks identical in both; the export bundles
// these families itself (build_render_font_bundle.mjs, render_font_axes.mjs).
export const STUDIO_TEMPLATE_FONT_QUERY = [
  'family=Cinzel:wght@600',
  'family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600',
  'family=Inter:wght@500;600;700;800;900',
  'family=Josefin+Sans:wght@600;700',
  'family=Lato:wght@400;900',
  'family=Libre+Baskerville',
  'family=Marcellus',
  'family=Montserrat:wght@300;500;600',
  'family=Mukta:wght@300;400;500;600;700;800',
  'family=Mulish:wght@700;800',
  'family=Nunito:wght@300..800',
  'family=Open+Sans:wght@400;600',
  'family=Oswald:wght@500;600;700',
  'family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,500;1,700',
  'family=Questrial',
  'family=Raleway:ital,wght@0,300;0,500;0,900;1,300',
  'family=Roboto:wght@500',
  'family=Space+Grotesk:wght@500;700',
  'family=Tiro+Devanagari+Hindi:ital@0;1',
  'family=Work+Sans:wght@300;400;500',
  // Picks
  'family=Sora:wght@400;500;600;700;800',
  'family=Instrument+Serif:ital@0;1',
  'family=IBM+Plex+Mono:wght@400;500;600',
  'family=Space+Mono:wght@400;700',
  'family=Syne:wght@700;800',
  'family=Bebas+Neue',
].join('&')

export const STUDIO_TEMPLATE_FONT_URL = `https://fonts.googleapis.com/css2?${STUDIO_TEMPLATE_FONT_QUERY}&display=swap`
