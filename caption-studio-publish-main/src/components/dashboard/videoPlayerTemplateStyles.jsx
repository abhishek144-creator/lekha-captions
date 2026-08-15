// Static CSS payload for the caption-template preview surfaces, split out of
// VideoPlayer.jsx (which was ~10.9k lines) so the player module holds playback
// and reveal LOGIC rather than ~2k lines of stylesheet text. Nothing here takes
// props or uses hooks — these are pure <style> emitters plus the host override
// string, so moving them cannot change render behaviour.
//
// Cascade note: the components are rendered in the same order and positions as
// before, so specificity and source order are unchanged.
//
// The release/motion/cpt gate scripts read this file together with
// VideoPlayer.jsx, because the selectors they assert on now live here.
import React from 'react'
import { ADVANCED_TEMPLATE_RUNTIME_CSS } from './templateMotionConfig'
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw'

function extractOriginalTemplateRuntimeCss() {
  const style = originalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  const startToken = '/* ===== SENTENCE BLOCKS ===== */';
  const start = style.indexOf(startToken);
  if (start < 0) return '';
  return style.slice(start);
}

export const APPLIED_TEMPLATE_HOST_OVERRIDES = `
  .lekha-applied-template-host {
    display: inline-block;
    width: var(--applied-template-width, 280px);
    max-width: min(94vw, var(--applied-template-width, 320px));
  }
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] {
    width: var(--applied-template-width, 280px);
    max-width: var(--applied-template-width, 280px);
  }
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] [data-lc-anim],
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] .plainwrap,
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] [data-lc-block-anim] {
    animation-play-state: paused !important;
  }
  .lekha-applied-template-host .lk-card,
  .lekha-applied-template-host .card {
    width: 100% !important;
    border: 0 !important; background: transparent !important;
    box-shadow: none !important; border-radius: 0 !important; padding: 0 !important;
    margin: 0 !important; display: block !important; overflow: visible !important;
  }
  .lekha-applied-template-host .lk-stage,
  .lekha-applied-template-host .stage {
    position: relative !important; inset: auto !important;
    background: transparent !important; box-shadow: none !important; border: 0 !important;
    overflow: visible !important; padding: 0 !important; margin: 0 !important; display: block !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    aspect-ratio: auto !important;
  }
  .lekha-applied-template-host .lc-card .sb {
    position: relative !important;
    inset: auto !important;
  }
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] .lc-card .sb {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    margin: 0 !important;
  }
  .lekha-applied-template-host.is-color-customized .lc-card .sb {
    --template-highlight: var(--sidebar-template-highlight, var(--sidebar-emphasis-accent, #DDAA03)) !important;
  }
  .lekha-applied-template-host .lc-card .sb:not(.active) {
    position: absolute !important;
    visibility: hidden !important;
    opacity: 0 !important;
  }
  .lekha-applied-template-host .lc-card .cap {
    position: relative !important;
    left: auto !important;
    top: auto !important;
    transform: none !important;
    width: 100% !important;
    max-width: 100% !important;
    text-align: center !important;
  }
  .lekha-applied-template-host .lc-card .scene,
  .lekha-applied-template-host .lc-card .cpt,
  .lekha-applied-template-host .lc-card .nline,
  .lekha-applied-template-host .lc-card .plain-s {
    width: fit-content !important;
    max-width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .lekha-applied-template-host .lc-card .stage {
    height: auto !important;
    aspect-ratio: auto !important;
  }
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] .lc-card .stage {
    position: relative !important;
    width: 100% !important;
    height: calc(var(--applied-template-width, 280px) * 1.28) !important;
    min-height: 220px !important;
    aspect-ratio: auto !important;
    container-type: inline-size !important;
    overflow: visible !important;
  }
  .lekha-applied-template-host[data-applied-template-source="lekha-lc"] .lc-card .cap {
    position: absolute !important;
    left: 50% !important;
    top: 52% !important;
    transform: translate(-50%, -50%) !important;
    width: 88% !important;
    max-width: 88% !important;
  }
  .lekha-applied-template-host[data-applied-template-selected="true"] .sb.active .cap,
  .lekha-applied-template-host[data-applied-template-selected="true"] .sblock.active .cap {
    outline: 1px solid #b76cff !important;
    outline-offset: 5px !important;
  }
  .lekha-applied-template-host .lc-card .stage::after {
    content: none !important;
    display: none !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  .lekha-applied-template-host .lc-card .sb .hero,
  .lekha-applied-template-host .lc-card .sb .is-emphasis,
  .lekha-applied-template-host .lc-card .sb .ns3hero,
  .lekha-applied-template-host .lc-card .sb .ns3box,
  .lekha-applied-template-host .lc-card .sb .ns3mark,
  .lekha-applied-template-host .lc-card .sb .ns3bracket,
  .lekha-applied-template-host .lc-card .sb .ns3dot,
  .lekha-applied-template-host .lc-card .sb [data-hero-emphasis='true'] {
    color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
    -webkit-text-fill-color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
    filter: saturate(1.35) brightness(1.12);
    font-weight: 900;
  }
  /* Complex-script glyphs have taller ascenders/matras than the Latin source
     words used to author the LC cards. Keep drop-cap heroes optically centered
     against their support rows, and center boxed keywords inside their frame
     without touching the authored entrance transform on the word itself. */
  .lekha-applied-template-host[data-applied-template-complex-script='true'] .lc-card .cpt.dropcap > .ln:first-child {
    position: relative !important;
    top: 0.18em !important;
  }
  .lekha-applied-template-host[data-applied-template-complex-script='true'] .lc-card .ns3box {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1.05 !important;
    padding-block: 0.12em 0.04em !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
  }
  .lekha-applied-template-host[data-applied-template-complex-script='true'] .lc-card .cpt .ln.box {
    display: inline-flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1.16 !important;
    padding-block: 0.14em 0.06em !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
  }
  .lekha-applied-template-host .lc-card .cpt {
    --hc: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
  }
  .lekha-applied-template-host .lc-card .sb .box {
    background: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
    color: #101114 !important;
    -webkit-text-fill-color: #101114 !important;
  }
  .lekha-applied-template-host .lc-card .sb .box .sw,
  .lekha-applied-template-host .lc-card .sb .box .hero {
    color: #101114 !important;
    -webkit-text-fill-color: #101114 !important;
  }
  .lekha-applied-template-host .sb,
  .lekha-applied-template-host .sblock,
  .lekha-applied-template-host .lekha-applied-advanced-template,
  .lekha-applied-template-host .lekha-template-fit {
    overflow: visible !important;
  }
  .lekha-applied-template-host .sb,
  .lekha-applied-template-host .sblock {
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 auto !important;
  }
  .lekha-applied-template-host [data-source-word-index] {
    display: inline-block !important;
    position: relative !important;
    overflow: visible !important;
    vertical-align: baseline !important;
  }
  .lekha-applied-template-host [data-source-word-styled="true"] {
    transform: none !important;
    opacity: 1 !important;
    animation: none !important;
    transition: none !important;
    clip-path: none !important;
  }
  .lekha-applied-template-host [data-source-word-visual="true"] {
    display: inline-block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    z-index: 6 !important;
    transform-origin: center center !important;
    vertical-align: baseline !important;
    white-space: nowrap !important;
    pointer-events: none !important;
  }
  .lekha-applied-template-host [data-source-word-spacer="true"] {
    display: inline-block !important;
    visibility: hidden !important;
    white-space: inherit !important;
    pointer-events: none !important;
  }
  .lekha-applied-template-host .lk-card-top,
  .lekha-applied-template-host .card-top,
  .lekha-applied-template-host .lk-dots,
  .lekha-applied-template-host .dots,
  .lekha-applied-template-host .slbl,
  .lekha-applied-template-host .lk-lbl,
  .lekha-applied-template-host .stage-lbl,
  .lekha-applied-template-host .lk-phase-chip { display: none !important; }
  /* Inherit the host's resolved (Devanagari-aware) font instead of the template's
     Latin display face, which has no Hindi glyphs. */
  .lekha-applied-template-host .sw,
  .lekha-applied-template-host .wbw-word,
  .lekha-applied-template-host .sw-w,
  .lekha-applied-template-host .w,
  .lekha-applied-template-host .plain-s,
  .lekha-applied-template-host .wbw,
  .lekha-applied-template-host .wbw-line,
  .lekha-applied-template-host [class^='pos'],
  .lekha-applied-template-host [class*=' pos'] {
    font-family: var(--sidebar-source-font, inherit) !important;
  }
  .lekha-applied-template-host .lc-card .script,
  .lekha-applied-template-host .lc-card .script .w {
    font-family: 'Great Vibes', cursive !important;
    font-weight: 400 !important;
    letter-spacing: 0 !important;
  }
  .lekha-applied-template-host .lc-card .serif,
  .lekha-applied-template-host .lc-card .serif .w {
    font-family: 'Fraunces', serif !important;
    font-style: italic !important;
    letter-spacing: 0 !important;
  }
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sb.active .w,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sb.active .w.in,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sb.active .sw,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sb.active .wbw-word,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sb.active .wbw-word.visible,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sblock.active .wbw-word,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sblock.active .wbw-word.visible,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sblock.active .sw-w,
  .lekha-applied-template-host:not([data-applied-template-animated="true"]) .sblock.active .sw {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    clip-path: inset(0 0 0 0) !important;
  }
  /* Paused editing uses the fully settled frame. This is also a race-proof
     fallback for a pause that lands while a wipe/roll transition is in flight. */
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sb.active .w,
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sb.active .sw,
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sb.active .wbw-word,
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sblock.active .wbw-word,
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sblock.active .sw-w,
  .lekha-applied-template-host[data-applied-template-paused="true"]:not([data-applied-template-selection-preview="true"]) .sblock.active .sw {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
    clip-path: inset(0 0 0 0) !important;
    overflow: visible !important;
  }
  /* During active playback the JS timing engine owns opacity/transform. Only
     cancel source CSS keyframes here; forcing opacity to 1 makes fade/typewrite
     phases run faster than the gallery preview. */
  .lekha-applied-template-host:not([data-applied-template-source="lekha-lc"]) .sb.active .w,
  .lekha-applied-template-host:not([data-applied-template-source="lekha-lc"]) .sb.active .wbw-word,
  .lekha-applied-template-host:not([data-applied-template-source="lekha-lc"]) .sblock.active .w,
  .lekha-applied-template-host:not([data-applied-template-source="lekha-lc"]) .sblock.active .wbw-word,
  .lekha-applied-template-host:not([data-applied-template-source="lekha-lc"]) .sblock.active .sw-w {
    animation: none !important;
  }
  /* Indic glyphs extend farther above/below the Latin metrics used by these
     source templates. Give their reveal boxes breathing room so matras are not
     shaved off by a clip-path animation. */
  .lekha-applied-template-host .w,
  .lekha-applied-template-host .wbw-word,
  .lekha-applied-template-host .sw,
  .lekha-applied-template-host .sw-w {
    overflow: visible !important;
    padding-block: 0.18em;
    margin-block: 0;
  }
  .lekha-applied-template-host .w:not(:last-child),
  .lekha-applied-template-host .wbw-word:not(:last-child),
  .lekha-applied-template-host .sw:not(:last-child),
  .lekha-applied-template-host .sw-w:not(:last-child) {
    margin-inline-end: 0.12em;
  }
  /* Flowing word lines laid out with flex/grid drop the literal space between
     word spans (whitespace-only text nodes are not flex items), so Devanagari
     words ended up touching. A column gap restores the inter-word spacing and is
     inert on non-flex lines, so normally-spaced lines are left unchanged. */
  .lekha-applied-template-host .wbw,
  .lekha-applied-template-host .wbw-line,
  .lekha-applied-template-host .sw-line,
  .lekha-applied-template-host .lekha-sidebar-source-line {
    column-gap: 0.28em;
  }
  /* Emphasis must not change line geometry. The gallery previews use the same
     safeguard; keeping the selected word at inherited metrics prevents Indic
     words from dropping onto a separate baseline in preview and export. */
  .lekha-applied-template-host .is-emphasis {
    display: inline-block !important;
    font-size: inherit !important;
    line-height: inherit !important;
    vertical-align: baseline !important;
    color: var(--sidebar-emphasis-accent, #DDAA03) !important;
    -webkit-text-fill-color: var(--sidebar-emphasis-accent, #DDAA03) !important;
  }
  .lekha-applied-template-host [data-paired-emphasis-underline='true'] {
    border-bottom: 0.055em solid currentColor !important;
    padding-bottom: 0.05em !important;
  }
  .lekha-applied-template-host .stage .w[class*='imp-'],
  .lekha-applied-template-host .stage .w[class*='ns2-'],
  .lekha-applied-template-host .stage .w[class*='ns3-'],
  .lekha-applied-template-host .stage .wbw-word[class*='imp-'],
  .lekha-applied-template-host .stage .wbw-word[class*='ns2-'],
  .lekha-applied-template-host .stage .wbw-word[class*='ns3-'] {
    display: inline-block !important;
    font-size: inherit !important;
    line-height: inherit !important;
    overflow: visible !important;
    padding-block: 0.18em !important;
    vertical-align: baseline !important;
  }
  .lekha-applied-template-host [data-source-word-gradient="true"] [data-source-word-visual="true"],
  .lekha-applied-template-host [data-source-word-gradient="true"] [data-source-word-visual="true"] * {
    background: var(--source-word-text-gradient) !important;
    background-image: var(--source-word-text-gradient) !important;
    background-size: 100% 100% !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    color: transparent !important;
  }
  .lekha-applied-template-host.has-text-gradient .w,
  .lekha-applied-template-host.has-text-gradient .wbw-word,
  .lekha-applied-template-host.has-text-gradient .sw,
  .lekha-applied-template-host.has-text-gradient .sw-w {
    background: var(--template-text-gradient) !important;
    background-image: var(--template-text-gradient) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    color: transparent !important;
  }
  .lekha-applied-template-host.has-highlight-gradient .is-emphasis,
  .lekha-applied-template-host.has-highlight-gradient .w[class*='imp-'],
  .lekha-applied-template-host.has-highlight-gradient .wbw-word[class*='imp-'] {
    background: var(--template-highlight-gradient) !important;
    background-image: var(--template-highlight-gradient) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    color: transparent !important;
  }
`;

export function OriginalAdvancedTemplateStyles() {
  return (
    <style>
      {`
        ${extractOriginalTemplateRuntimeCss()}
        ${ADVANCED_TEMPLATE_RUNTIME_CSS}

        .lekha-original-template {
          --gold: #d4af37;
          --rose: #ff3d71;
          --cyan: #00e5ff;
          --green: #39ff14;
          --purple: #a78bfa;
          --white: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: auto;
          max-width: min(82vw, 360px);
          color: #fff;
          text-align: center;
          pointer-events: auto;
          overflow: visible !important;
        }

        .lekha-original-template[class*='t'][class*='-stage'] {
          background: transparent !important;
          box-shadow: none !important;
        }

        .lekha-original-template .sblock {
          position: relative !important;
          inset: auto !important;
          display: inline-flex !important;
          width: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          opacity: 1;
          padding: 0 !important;
          overflow: visible !important;
          white-space: normal;
        }

        .lekha-original-template .lekha-template-fit {
          display: inline-block;
          max-width: 100%;
          overflow: visible !important;
        }

        .lekha-original-template .lekha-applied-advanced-template,
        .lekha-original-template .lekha-template-fit {
          overflow: visible !important;
        }

        .lekha-original-template [data-source-word-index] {
          display: inline-block !important;
          position: relative !important;
          overflow: visible !important;
          vertical-align: baseline !important;
        }

        .lekha-original-template [data-source-word-styled="true"] {
          transform: none !important;
          opacity: 1 !important;
          animation: none !important;
          transition: none !important;
          clip-path: none !important;
        }

        .lekha-original-template [data-source-word-visual="true"] {
          display: inline-block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          z-index: 6 !important;
          transform-origin: center center !important;
          vertical-align: baseline !important;
          white-space: nowrap !important;
          pointer-events: none !important;
        }

        .lekha-original-template [data-source-word-spacer="true"] {
          display: inline-block !important;
          visibility: hidden !important;
          white-space: inherit !important;
          pointer-events: none !important;
        }

        .lekha-original-template [data-source-word-gradient="true"] [data-source-word-visual="true"],
        .lekha-original-template [data-source-word-gradient="true"] [data-source-word-visual="true"] * {
          background: var(--source-word-text-gradient) !important;
          background-image: var(--source-word-text-gradient) !important;
          background-size: 100% 100% !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
        }

        .lekha-original-template .wbw-rise,
        .lekha-original-template .wbw-slide,
        .lekha-original-template .wbw-seq,
        .lekha-original-template .wbw-seq-fade {
          column-gap: 0.24em;
          row-gap: 0.08em;
        }

        .lekha-original-template:is(
          .t11-stage,
          .t13-stage,
          .t16-stage,
          .t17-stage,
          .t24-stage
        ) .wbw-rise,
        .lekha-original-template:is(
          .t11-stage,
          .t13-stage,
          .t16-stage,
          .t17-stage,
          .t24-stage
        ) .wbw-slide,
        .lekha-original-template:is(
          .t11-stage,
          .t13-stage,
          .t16-stage,
          .t17-stage,
          .t24-stage
        ) .wbw-seq-fade {
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
        }

        .lekha-original-template.t29-stage .lekha-applied-advanced-template,
        .lekha-original-template.t29-stage .lekha-template-fit {
          max-width: min(84vw, 11.5em) !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
          line-height: 1.12 !important;
          font-size: 1em !important;
        }

        .lekha-original-template.t29-stage .wbw-rise,
        .lekha-original-template.t29-stage .wbw-slide {
          flex-wrap: wrap !important;
          row-gap: 0.04em !important;
        }

        .lekha-original-template .lekha-template-preview-lines {
          display: block !important;
          text-align: center !important;
          line-height: 1.2 !important;
        }

        .lekha-original-template .lekha-template-preview-line {
          display: block !important;
          white-space: nowrap !important;
          text-align: center !important;
        }

        .lekha-original-template .cluster-wrap {
          align-items: stretch;
        }

        .lekha-original-template.t11-stage .lekha-applied-advanced-template,
        .lekha-original-template.t11-stage .lekha-template-fit,
        .lekha-original-template.t11-stage .lekha-template-preview-lines,
        .lekha-original-template.t11-stage .lekha-template-preview-line,
        .lekha-original-template.t11-stage .wbw-rise,
        .lekha-original-template.t11-stage .wbw-slide,
        .lekha-original-template.t11-stage .wbw-seq-fade,
        .lekha-original-template.t11-stage .w,
        .lekha-original-template.t11-stage .cluster-row-top,
        .lekha-original-template.t11-stage .cluster-row-bot,
        .lekha-original-template.t11-stage .cluster-hl,
        .lekha-original-template.t11-stage .blur-txt {
          font-size: 1em !important;
          line-height: 1.28 !important;
        }

        .lekha-original-template.t11-stage .t11-b0 .cluster-row-top,
        .lekha-original-template.t11-stage .t11-b0 .cluster-row-bot,
        .lekha-original-template.t11-stage .t11-b1,
        .lekha-original-template.t11-stage .t11-b1 .blur-txt,
        .lekha-original-template.t11-stage .t11-b2,
        .lekha-original-template.t11-stage .t11-b2 .lekha-template-fit,
        .lekha-original-template.t11-stage .t11-b3 .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t13-stage .t13-b0 .slide-crash,
        .lekha-original-template.t13-stage .t13-b1 .ticker-txt,
        .lekha-original-template.t13-stage .w.in {
          font-family: 'IBM Plex Mono', monospace !important;
          font-weight: 700 !important;
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316 !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t13-stage .t13-b2 .w.in:not([data-imp='true']),
        .lekha-original-template.t13-stage .t13-b3 .w.in:not([data-imp='true']) {
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316 !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t13-stage .imp-cyan,
        .lekha-original-template.t13-stage .imp-bold,
        .lekha-original-template.t13-stage .w.in[data-imp='true'],
        .lekha-original-template.t13-stage .w[data-hero-emphasis='true'],
        .lekha-original-template.t13-stage .slide-crash .is-emphasis,
        .lekha-original-template.t13-stage .ticker-txt .is-emphasis {
          font-weight: 900 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
          text-shadow: 0 0 12px rgba(255,255,255,0.35) !important;
        }

        .lekha-original-template.t13-stage .lekha-applied-advanced-template,
        .lekha-original-template.t13-stage .lekha-template-fit,
        .lekha-original-template.t13-stage .wbw-rise,
        .lekha-original-template.t13-stage .wbw-slide,
        .lekha-original-template.t13-stage .wbw-seq-fade,
        .lekha-original-template.t13-stage .t13-b0 .slide-crash,
        .lekha-original-template.t13-stage .t13-b1 .ticker-txt {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          align-items: center !important;
          max-width: min(100%, 13.5em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          line-height: 1.2 !important;
          letter-spacing: 0.02em !important;
          text-align: center !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line,
        .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
          max-width: min(100%, 12em) !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          text-transform: none !important;
        }

        .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line {
          font-size: 1.12rem !important;
        }

        .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
          font-size: 0.98rem !important;
        }

        .lekha-original-template.t15-stage .lekha-applied-advanced-template,
        .lekha-original-template.t15-stage .lekha-template-fit,
        .lekha-original-template.t15-stage .shake-in,
        .lekha-original-template.t15-stage .pop-txt,
        .lekha-original-template.t15-stage .wbw-rise,
        .lekha-original-template.t15-stage .wbw-seq-fade,
        .lekha-original-template.t15-stage .w.in {
          font-size: 0.88em !important;
          line-height: 1.28 !important;
        }
        .lekha-original-template.t15-stage .shake-in > br {
          display: block !important;
          content: '' !important;
        }

        .lekha-original-template.t35-stage .lekha-applied-advanced-template,
        .lekha-original-template.t35-stage .lekha-template-fit,
        .lekha-original-template.t35-stage .secret-txt {
          display: inline-block !important;
          max-width: min(100%, 12.5em) !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
          line-height: 1.22 !important;
          text-align: center !important;
        }

        .lekha-original-template.t14-stage .t14-block,
        .lekha-original-template.t14-stage .t14-b0 .flip-line,
        .lekha-original-template.t14-stage .t14-b1 .drop-txt,
        .lekha-original-template.t14-stage .t14-b2,
        .lekha-original-template.t14-stage .t14-b2 span,
        .lekha-original-template.t14-stage .t14-b3 .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        /* Applied templates never receive the standalone-preview '.in' class,
           so force the underline highlight (T14 last line) to full width. */
        .lekha-original-template .imp-underline::after {
          width: 100% !important;
        }

        /* T16 (Motivation Stack) — the legacy '.t16 .wbw-rise' rule in
           captionTemplatesAdvanced.css dims words to 50% white. Restore the
           template's intended cyan body + white emphasis to match the preview. */
        .lekha-original-template.t16-stage .t16-block,
        .lekha-original-template.t16-stage .neon-line,
        .lekha-original-template.t16-stage .wbw-rise .w,
        .lekha-original-template.t16-stage .wbw-slide .w {
          color: var(--cyan) !important;
          -webkit-text-fill-color: var(--cyan) !important;
        }

        .lekha-original-template.t16-stage .w[data-imp='true'],
        .lekha-original-template.t16-stage .imp-bold {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        /* T17 (Horror) — the rose "snap" line overlays directly on the video
           (the dark stage background is transparent in the editor/export), so a
           semi-transparent red washes out. Keep it fully opaque, unblurred, and
           shadowed so it stays legible on any footage. */
        /* T18 (Cinematic) keeps its authored split/fade motion; only static
           colour parity is handled below. */
        .lekha-original-template.t17-stage .t17-block,
        .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
        .lekha-original-template.t17-stage .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t17-stage .imp-flicker,
        .lekha-original-template.t17-stage .w.in[data-imp='true'],
        .lekha-original-template.t17-stage .w[data-hero-emphasis='true'] {
          color: #ff3d71 !important;
          -webkit-text-fill-color: #ff3d71 !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t17-stage .letter-snap-blk,
        .lekha-original-template.t17-stage .snap-txt {
          opacity: 1 !important;
          filter: none !important;
        }

        .lekha-original-template.t17-stage .snap-txt,
        .lekha-original-template.t17-stage .snap-txt * {
          color: #ff3d71 !important;
          -webkit-text-fill-color: #ff3d71 !important;
          text-shadow: 0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22) !important;
        }

        .lekha-original-template.t17-stage .glitch-wrap,
        .lekha-original-template.t17-stage .t17-b0 .lekha-template-fit,
        .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
        .lekha-original-template.t17-stage .wbw-rise .w.in,
        .lekha-original-template.t17-stage .wbw-slide .w.in,
        .lekha-original-template.t17-stage .wbw-seq-fade .w.in {
          font-size: max(1em, 20px) !important;
          line-height: 1.32 !important;
        }

        .lekha-original-template.t18-stage .t18-block,
        .lekha-original-template.t18-stage .t18-b2 .lekha-template-fit,
        .lekha-original-template.t18-stage .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t18-stage .split-top {
          display: block !important;
          color: rgba(255,255,255,0.92) !important;
          -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
          font-size: 0.5em !important;
          letter-spacing: 0.18em !important;
          text-transform: uppercase !important;
        }

        .lekha-original-template.t18-stage .split-title {
          display: inline-block !important;
          text-align: center !important;
          font-size: max(1em, 1.65rem) !important;
          line-height: 1.2 !important;
        }

        .lekha-original-template.t18-stage .split-bot,
        .lekha-original-template.t18-stage .reveal-txt {
          display: block !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .lekha-original-template.t18-stage .split-bot {
          font-size: 1em !important;
          font-weight: 700 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
        }

        .lekha-original-template.t18-stage .imp-purple,
        .lekha-original-template.t18-stage .w.in[data-imp='true'],
        .lekha-original-template.t18-stage .w[data-hero-emphasis='true'] {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t19-stage .t19-block,
        .lekha-original-template.t19-stage .lekha-applied-advanced-template,
        .lekha-original-template.t19-stage .lekha-template-fit,
        .lekha-original-template.t19-stage .wbw-rise,
        .lekha-original-template.t19-stage .wbw-seq-fade,
        .lekha-original-template.t19-stage .rise-unit,
        .lekha-original-template.t19-stage .slash-wrap,
        .lekha-original-template.t19-stage .w,
        .lekha-original-template.t19-stage .w.in:not([data-imp='true']) {
          font-family: 'Archivo Black', sans-serif !important;
          font-size: 1em !important;
          font-weight: 900 !important;
          line-height: 1.32 !important;
          letter-spacing: 0.02em !important;
          text-transform: uppercase !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t19-stage .imp-rose,
        .lekha-original-template.t19-stage .imp-bold,
        .lekha-original-template.t19-stage .w.in[data-imp='true'],
        .lekha-original-template.t19-stage .w[data-hero-emphasis='true'] {
          color: var(--rose) !important;
          -webkit-text-fill-color: var(--rose) !important;
          font-size: 1em !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t19-stage .wbw-rise,
        .lekha-original-template.t19-stage .wbw-seq-fade {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          max-width: min(100%, 12em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
        }

        .lekha-original-template.t23-stage .t23-b3 .imp-bold,
        .lekha-original-template.t23-stage .t23-b3 .imp-gold,
        .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
        }

        .lekha-original-template.t24-stage .t24-block,
        .lekha-original-template.t24-stage .lekha-applied-advanced-template,
        .lekha-original-template.t24-stage .lekha-template-fit {
          font-size: 1em !important;
          line-height: 1.28 !important;
          max-width: min(100%, 9.8em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          text-align: center !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t24-stage {
          width: auto !important;
          max-width: min(82vw, 360px) !important;
        }

        .lekha-original-template.t24-stage .wbw-rise,
        .lekha-original-template.t24-stage .wbw-slide,
        .lekha-original-template.t24-stage .wbw-seq-fade,
        .lekha-original-template.t24-stage .kf-line,
        .lekha-original-template.t24-stage .slow-rise,
        .lekha-original-template.t24-stage .rw {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          align-items: baseline !important;
          justify-content: center !important;
          column-gap: 0.28em !important;
          row-gap: 0.12em !important;
          max-width: min(100%, 9.8em) !important;
          text-align: center !important;
        }

        .lekha-original-template.t24-stage .lekha-template-preview-lines {
          display: block !important;
          line-height: 1.28 !important;
          max-width: min(100%, 9.8em) !important;
          text-align: center !important;
        }

        .lekha-original-template.t24-stage .lekha-template-preview-line {
          display: block !important;
          white-space: nowrap !important;
          line-height: 1.28 !important;
          text-align: center !important;
        }

        .lekha-original-template.t24-stage .w,
        .lekha-original-template.t24-stage .w.in:not([data-imp='true']) {
          display: inline-block !important;
          margin-right: 0 !important;
          font-size: 1em !important;
          line-height: 1.28 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t24-stage .redact-block,
        .lekha-original-template.t24-stage .imp-purple,
        .lekha-original-template.t24-stage .imp-orange,
        .lekha-original-template.t24-stage .w.in[data-imp='true'],
        .lekha-original-template.t24-stage .w[data-hero-emphasis='true'] {
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316 !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t25-stage .t25-block,
        .lekha-original-template.t25-stage .lekha-applied-advanced-template,
        .lekha-original-template.t25-stage .lekha-template-fit,
        .lekha-original-template.t25-stage .hand-txt,
        .lekha-original-template.t25-stage .soft-rise,
        .lekha-original-template.t25-stage .wbw-rise,
        .lekha-original-template.t25-stage .wbw-slide,
        .lekha-original-template.t25-stage .w.in:not([data-imp='true']) {
          max-width: min(100%, 13em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          text-align: center !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t25-stage .hand-txt,
        .lekha-original-template.t25-stage .soft-rise {
          display: inline-block !important;
          line-height: 1.55 !important;
        }

        .lekha-original-template.t25-stage .lekha-template-preview-lines {
          display: block !important;
          line-height: 1.55 !important;
          max-width: min(100%, 13em) !important;
          text-align: center !important;
        }

        .lekha-original-template.t25-stage .lekha-template-preview-line {
          display: block !important;
          white-space: nowrap !important;
          line-height: 1.55 !important;
          text-align: center !important;
        }

        .lekha-original-template.t25-stage .wbw-rise,
        .lekha-original-template.t25-stage .wbw-slide {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          align-items: baseline !important;
          justify-content: center !important;
          column-gap: 0.28em !important;
          row-gap: 0.12em !important;
        }

        .lekha-original-template.t25-stage .w {
          margin-right: 0 !important;
        }

        .lekha-original-template.t25-stage .imp-italic,
        .lekha-original-template.t25-stage .imp-rose,
        .lekha-original-template.t25-stage .w.in[data-imp='true'],
        .lekha-original-template.t25-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t26-stage .t26-block,
        .lekha-original-template.t26-stage .lekha-applied-advanced-template,
        .lekha-original-template.t26-stage .lekha-template-fit,
        .lekha-original-template.t26-stage .wbw-rise,
        .lekha-original-template.t26-stage .wbw-slide,
        .lekha-original-template.t26-stage .wbw-seq-fade,
        .lekha-original-template.t26-stage .w,
        .lekha-original-template.t26-stage .hard-txt,
        .lekha-original-template.t26-stage .fast-slide,
        .lekha-original-template.t26-stage .w.in:not([data-imp='true']) {
          max-width: min(100%, 11.5em) !important;
          white-space: normal !important;
          text-align: center !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t26-stage .wbw-rise,
        .lekha-original-template.t26-stage .wbw-slide,
        .lekha-original-template.t26-stage .wbw-seq-fade {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
        }

        .lekha-original-template.t26-stage .imp-rose,
        .lekha-original-template.t26-stage .imp-bold,
        .lekha-original-template.t26-stage .w.in[data-imp='true'],
        .lekha-original-template.t26-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t27-stage .t27-block,
        .lekha-original-template.t27-stage .center-expand-txt,
        .lekha-original-template.t27-stage .t27-b1 .lekha-template-fit,
        .lekha-original-template.t27-stage .t27-b2 .lekha-template-fit,
        .lekha-original-template.t27-stage .w.in:not([data-imp='true']) {
          color: var(--cyan) !important;
          -webkit-text-fill-color: var(--cyan) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t27-stage .imp-cyan,
        .lekha-original-template.t27-stage .imp-bold,
        .lekha-original-template.t27-stage .w.in[data-imp='true'],
        .lekha-original-template.t27-stage .w[data-hero-emphasis='true'] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t28-stage .t28-block,
        .lekha-original-template.t28-stage .lekha-applied-advanced-template,
        .lekha-original-template.t28-stage .lekha-template-fit,
        .lekha-original-template.t28-stage .grain-txt,
        .lekha-original-template.t28-stage .slow-fade,
        .lekha-original-template.t28-stage .wbw-rise,
        .lekha-original-template.t28-stage .wbw-seq-fade,
        .lekha-original-template.t28-stage .w {
          font-family: 'Bitter', serif !important;
          font-size: 1em !important;
          line-height: 1.48 !important;
          color: rgba(255,255,255,0.92) !important;
          -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
          opacity: 1 !important;
          max-width: min(100%, 13em) !important;
          white-space: normal !important;
          text-align: center !important;
        }

        .lekha-original-template.t28-stage .imp-gold,
        .lekha-original-template.t28-stage .imp-italic,
        .lekha-original-template.t28-stage .w.in[data-imp='true'],
        .lekha-original-template.t28-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t29-stage .t29-block,
        .lekha-original-template.t29-stage .hard-rise,
        .lekha-original-template.t29-stage .w,
        .lekha-original-template.t29-stage .w.in:not([data-imp='true']),
        .lekha-original-template.t29-stage .lekha-template-fit {
          font-family: 'Teko', sans-serif !important;
          font-size: 1em !important;
          font-weight: 700 !important;
          line-height: 1.02 !important;
          letter-spacing: 0.035em !important;
          text-transform: uppercase !important;
          max-width: min(100%, 10.5em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          text-align: center !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t29-stage .battle-slide,
        .lekha-original-template.t29-stage .imp-rose,
        .lekha-original-template.t29-stage .w.in[data-imp='true'],
        .lekha-original-template.t29-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
          opacity: 1 !important;
          text-shadow: 0 0 12px rgba(249,115,22,0.28) !important;
        }

        .lekha-original-template.t29-stage .wbw-rise,
        .lekha-original-template.t29-stage .wbw-slide,
        .lekha-original-template.t29-stage .wbw-seq-fade {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          column-gap: 0.14em !important;
          row-gap: 0 !important;
        }

        .lekha-original-template.t30-stage .t30-block,
        .lekha-original-template.t30-stage .lekha-applied-advanced-template,
        .lekha-original-template.t30-stage .lekha-template-fit,
        .lekha-original-template.t30-stage .breathe-txt {
          font-family: 'Cormorant Garamond', serif !important;
          font-size: 1em !important;
          font-style: italic !important;
          font-weight: 600 !important;
          line-height: 1.62 !important;
          max-width: min(100%, 13em) !important;
          white-space: normal !important;
          text-align: center !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t30-stage .imp-italic {
          color: #b4d2c8 !important;
          -webkit-text-fill-color: #b4d2c8 !important;
        }

        .lekha-original-template.t31-stage .t31-block,
        .lekha-original-template.t31-stage .stamp-text,
        .lekha-original-template.t31-stage .flip-line,
        .lekha-original-template.t31-stage .t31-b2 .lekha-template-fit,
        .lekha-original-template.t31-stage .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t31-stage .imp-gold,
        .lekha-original-template.t31-stage .w.in[data-imp='true'],
        .lekha-original-template.t31-stage .w[data-hero-emphasis='true'] {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t33-stage .t33-block,
        .lekha-original-template.t33-stage .lekha-applied-advanced-template,
        .lekha-original-template.t33-stage .lekha-template-fit,
        .lekha-original-template.t33-stage .doc-line,
        .lekha-original-template.t33-stage .w,
        .lekha-original-template.t33-stage .w.in:not([data-imp='true']) {
          font-family: 'Noto Sans', sans-serif !important;
          font-size: 1em !important;
          font-weight: 700 !important;
          line-height: 1.32 !important;
          text-align: center !important;
          max-width: min(100%, 18em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t33-stage .wbw-rise,
        .lekha-original-template.t33-stage .wbw-slide,
        .lekha-original-template.t33-stage .wbw-seq-fade {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          align-items: baseline !important;
          justify-content: center !important;
          column-gap: 0.24em !important;
          row-gap: 0.04em !important;
          max-width: min(100%, 18em) !important;
          white-space: normal !important;
        }

        .lekha-original-template.t33-stage .imp-cyan,
        .lekha-original-template.t33-stage .imp-bold,
        .lekha-original-template.t33-stage .w.in[data-imp='true'],
        .lekha-original-template.t33-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t34-stage .t34-block,
        .lekha-original-template.t34-stage .pow-txt,
        .lekha-original-template.t34-stage .w,
        .lekha-original-template.t34-stage .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t34-stage .imp-cyan,
        .lekha-original-template.t34-stage .imp-bold,
        .lekha-original-template.t34-stage .w.in[data-imp='true'],
        .lekha-original-template.t34-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t34-stage .pow-txt {
          font-size: max(0.96em, 20px) !important;
          line-height: 1.28 !important;
        }

        .lekha-original-template .wbw-rise .w,
        .lekha-original-template .wbw-slide .w,
        .lekha-original-template .wbw-seq .w,
        .lekha-original-template .wbw-seq-fade .w {
          opacity: 0;
          display: inline-block;
          transition: none;
        }

        .lekha-original-template .wbw-rise .w,
        .lekha-original-template .wbw-seq .w,
        .lekha-original-template .wbw-seq-fade .w {
          transform: translateY(20px);
        }

        .lekha-original-template .wbw-slide .w {
          transform: translateX(-16px);
        }

        .lekha-original-template .active .wbw-rise .w.in,
        .lekha-original-template .active .wbw-slide .w.in,
        .lekha-original-template .active .wbw-seq .w.in,
        .lekha-original-template .active .wbw-seq-fade .w.in {
          animation: lekhaTemplateWbwIn 320ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
          animation-delay: var(--wbw-delay, 0ms);
        }

        .lekha-original-template .active .wbw-rise .w[data-imp='true'].in,
        .lekha-original-template .active .wbw-slide .w[data-imp='true'].in,
        .lekha-original-template .active .wbw-seq .w[data-imp='true'].in,
        .lekha-original-template .active .wbw-seq-fade .w[data-imp='true'].in {
          animation-duration: 440ms;
        }

        .lekha-original-template.t29-stage .battle-sweep-left .w {
          transform: translateX(-34px);
        }

        .lekha-original-template.t29-stage .battle-lift-up .w {
          transform: translateY(28px);
        }

        .lekha-original-template.t29-stage .active .battle-sweep-left .w.in,
        .lekha-original-template.t29-stage .active .battle-lift-up .w.in {
          animation: lekhaTemplateWbwIn 360ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: var(--wbw-delay, 0ms);
        }

        .lekha-original-template.t29-stage .active .battle-sweep-left .w[data-imp='true'].in,
        .lekha-original-template.t29-stage .active .battle-lift-up .w[data-imp='true'].in {
          animation-duration: 400ms;
        }

        .lekha-original-template .lekha-applied-advanced-template.t22-block,
        .lekha-original-template .lekha-applied-advanced-template.t28-block,
        .lekha-original-template .lekha-applied-advanced-template.t22-block .wave-txt,
        .lekha-original-template .lekha-applied-advanced-template.t22-block .kf-line,
        .lekha-original-template .lekha-applied-advanced-template.t28-block .grain-txt,
        .lekha-original-template .lekha-applied-advanced-template.t28-block .slow-fade,
        .lekha-original-template .lekha-applied-advanced-template.t22-block .w.in:not([data-imp='true']),
        .lekha-original-template .lekha-applied-advanced-template.t28-block .w.in:not([data-imp='true']) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
        }

        .lekha-original-template .lekha-applied-advanced-template.t22-block .kf-base {
          color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
          paint-order: fill !important;
          opacity: 1 !important;
        }

        .lekha-original-template .kf-line {
          display: inline-block;
          max-width: 100%;
          text-align: center;
          white-space: normal;
        }

        .lekha-original-template .kf-word {
          display: inline-block;
          position: relative;
          white-space: pre;
        }

        .lekha-original-template .kf-base {
          display: block;
          color: rgba(255, 255, 255, 0.25) !important;
          -webkit-text-fill-color: rgba(255, 255, 255, 0.25) !important;
        }

        .lekha-original-template .kf-fill {
          position: absolute;
          inset: 0;
          display: block;
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          clip-path: inset(0 100% 0 0);
        }

        .lekha-original-template .active .kf-fill {
          animation: lekhaKaraokeFill var(--kf-duration, 360ms) linear forwards;
          animation-delay: var(--kf-delay, 0ms);
        }

        .lekha-original-template .t24-b4 .kf-fill {
          color: #fb923c !important;
          -webkit-text-fill-color: #fb923c !important;
        }

        .lekha-original-template .t33-b2 .kf-fill {
          color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
        }

        .lekha-original-template .t33-b2 .kf-base {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }

        .lekha-original-template .t36-b1 .kf-fill {
          color: var(--template-karaoke-2, #22d3ee) !important;
          -webkit-text-fill-color: var(--template-karaoke-2, #22d3ee) !important;
        }

        .lekha-original-template .t36-b2 .kf-fill {
          color: var(--template-karaoke-3, #fb923c) !important;
          -webkit-text-fill-color: var(--template-karaoke-3, #fb923c) !important;
        }

        .lekha-original-template .t36-b0 .kf-fill {
          color: var(--template-karaoke-1, var(--template-highlight, var(--gold))) !important;
          -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, var(--gold))) !important;
        }

        .lekha-original-template .lekha-applied-advanced-template.active .karaoke-base {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          opacity: 1 !important;
        }

        @keyframes lekhaKaraokeFill {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0% 0 0); }
        }

        .lekha-original-template .imp-gold {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
          paint-order: fill !important;
        }

        .lekha-original-template .lekha-applied-advanced-template.t22-block .kf-fill {
          color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
          paint-order: fill !important;
        }

        .lekha-original-template .imp-rose {
          color: var(--rose) !important;
          -webkit-text-fill-color: var(--rose) !important;
        }

        .lekha-original-template .imp-cyan {
          color: var(--cyan) !important;
          -webkit-text-fill-color: var(--cyan) !important;
        }

        .lekha-original-template .imp-purple {
          color: var(--purple) !important;
          -webkit-text-fill-color: var(--purple) !important;
        }

        .lekha-original-template .imp-green {
          color: var(--green) !important;
          -webkit-text-fill-color: var(--green) !important;
        }

        .lekha-original-template .is-emphasis {
          color: var(--template-secondary, var(--gold)) !important;
          -webkit-text-fill-color: currentColor !important;
          font-weight: 900;
          text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent);
        }

        .lekha-original-template.t33-stage .t33-block,
        .lekha-original-template.t33-stage .lekha-applied-advanced-template,
        .lekha-original-template.t33-stage .lekha-template-fit,
        .lekha-original-template.t33-stage .doc-line,
        .lekha-original-template.t33-stage .w,
        .lekha-original-template.t33-stage .w.in:not([data-imp='true']) {
          font-family: 'Noto Sans', sans-serif !important;
          font-size: 1em !important;
          font-weight: 700 !important;
          line-height: 1.32 !important;
          text-align: center !important;
          max-width: min(100%, 18em) !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t33-stage .wbw-rise,
        .lekha-original-template.t33-stage .wbw-slide,
        .lekha-original-template.t33-stage .wbw-seq-fade {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          align-items: baseline !important;
          justify-content: center !important;
          column-gap: 0.24em !important;
          row-gap: 0.04em !important;
          max-width: min(100%, 18em) !important;
          white-space: normal !important;
        }

        .lekha-original-template.t33-stage .imp-cyan,
        .lekha-original-template.t33-stage .imp-bold,
        .lekha-original-template.t33-stage .w.in[data-imp='true'],
        .lekha-original-template.t33-stage .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t21-stage,
        .lekha-original-template.t21-stage *,
        .lekha-original-template.t21-stage .w.in,
        .lekha-original-template.t21-stage .imp-italic,
        .lekha-original-template.t21-stage .imp-weight {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t37-stage .t37-block,
        .lekha-original-template.t37-stage .neon-pulse,
        .lekha-original-template.t37-stage .neon-expand,
        .lekha-original-template.t37-stage .w.in:not([data-imp='true']) {
          color: var(--template-primary, #e1da09) !important;
          -webkit-text-fill-color: var(--template-primary, #e1da09) !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t37-stage .imp-green,
        .lekha-original-template.t37-stage .w.in[data-imp='true'] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
        }

        .lekha-original-template.t38-stage .imp-underline,
        .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline {
          position: relative !important;
          display: inline-block !important;
          font-weight: 900 !important;
          color: var(--template-secondary, var(--gold, #d4af37)) !important;
          -webkit-text-fill-color: currentColor !important;
          text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent) !important;
          overflow: visible !important;
        }

        .lekha-original-template.t38-stage .imp-underline::after,
        .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline::after {
          content: '' !important;
          position: absolute !important;
          left: 0 !important;
          bottom: -2px !important;
          width: 100% !important;
          height: max(2px, 0.08em) !important;
          background: var(--gold, #d4af37) !important;
          display: block !important;
          opacity: 1 !important;
          clip-path: inset(0 0 0 0) !important;
        }

        .t21 .word,
        .t21 .word.active,
        .t21 .word.current,
        .t21 .word.done,
        .t21 .word.imp {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .t37 .word.current,
        .t37 .word.imp.active,
        .t37 .word.imp.current {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .lekha-original-template.t12-stage .imp-purple {
          color: var(--rose) !important;
          -webkit-text-fill-color: var(--rose) !important;
        }

        .lekha-original-template.t18-stage .imp-purple {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
        }

        .lekha-original-template.t24-stage .imp-purple {
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316 !important;
        }

        .lekha-original-template.t32-stage .imp-purple {
          color: var(--cyan) !important;
          -webkit-text-fill-color: var(--cyan) !important;
        }

        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template {
          --gold: var(--template-secondary, #d4af37);
          --rose: var(--template-secondary, #ff3d71);
          --cyan: var(--template-secondary, #00e5ff);
          --green: var(--template-secondary, #39ff14);
          --purple: var(--template-secondary, #a78bfa);
          color: var(--template-primary, #ffffff) !important;
        }

        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-template-fit,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .w.in:not([data-imp='true']),
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .kf-base,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .cluster-row-top,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .cluster-row-bot,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .blur-txt {
          color: var(--template-primary, #ffffff) !important;
          -webkit-text-fill-color: var(--template-primary, #ffffff) !important;
        }

        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .is-emphasis,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template [data-imp='true'],
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .w.in[data-imp='true'],
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template [data-hero-emphasis='true'],
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-gold,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-rose,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-cyan,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-purple,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-green,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-orange,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-bold,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-italic,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-weight,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-space,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-flicker,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-underline {
          color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
        }

        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template.t22-block .kf-base,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template.t22-block .kf-fill,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template.t22-block .imp-gold,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template.t22-block .w.in[data-imp='true'],
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .lekha-applied-advanced-template.t22-block .w[data-hero-emphasis='true'] {
          color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
          paint-order: fill !important;
          opacity: 1 !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t36-stage .t36-b0 .kf-fill,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t36-stage .t36-b0 .kf-fill {
          color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
          -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t36-stage .kf-base,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t36-stage .kf-base {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t36-stage .t36-b1 .kf-fill,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t36-stage .t36-b1 .kf-fill {
          color: var(--template-karaoke-2, #22D3EE) !important;
          -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t36-stage .t36-b2 .kf-fill,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t36-stage .t36-b2 .kf-fill {
          color: var(--template-karaoke-3, #FB923C) !important;
          -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t35-stage .imp-italic,
        .lekha-advanced-template-runtime .lekha-original-template.t35-stage .is-emphasis,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t35-stage .imp-italic,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t35-stage .is-emphasis {
          color: var(--template-primary, #dcd2dc) !important;
          -webkit-text-fill-color: var(--template-primary, #dcd2dc) !important;
          text-shadow: none !important;
        }

        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .imp-underline::after,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template .w[data-imp='true'].imp-underline::after {
          background: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t37-stage .imp-green,
        .lekha-advanced-template-runtime .lekha-original-template.t37-stage .w.in[data-imp='true'],
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t37-stage .imp-green,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t37-stage .w.in[data-imp='true'] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          -webkit-text-stroke: 0 transparent !important;
          text-shadow: none !important;
        }

        .lekha-advanced-template-runtime .lekha-original-template.t23-stage .t23-b3 .imp-bold,
        .lekha-advanced-template-runtime .lekha-original-template.t23-stage .t23-b3 .imp-gold,
        .lekha-advanced-template-runtime .lekha-original-template.t23-stage .t23-b3 .is-emphasis,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-bold,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-gold,
        .lekha-advanced-template-runtime.is-color-customized .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
        }

        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: min(92vw, 18em) !important;
          max-width: min(92vw, 18em) !important;
          max-height: 4.4em !important;
          overflow: hidden !important;
          text-align: center !important;
        }

        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .t33-block,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .lekha-applied-advanced-template,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .lekha-template-fit,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .doc-line,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .wbw-rise,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .wbw-slide,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .wbw-seq-fade,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .kf-line {
          display: inline-flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          max-width: 100% !important;
          max-height: 4.4em !important;
          overflow: hidden !important;
          font-size: 0.9em !important;
          line-height: 1.22 !important;
          text-align: center !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          column-gap: 0.22em !important;
          row-gap: 0.08em !important;
          padding: 0 !important;
          margin: 0 auto !important;
          transform: none !important;
        }

        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .lekha-template-preview-lines,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .doc-line {
          display: grid !important;
          grid-auto-rows: min-content !important;
          gap: 0.08em !important;
        }

        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .lekha-template-preview-line,
        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .doc-line > span {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-align: center !important;
          line-height: 1.22 !important;
        }

        .lekha-advanced-template-runtime[data-advanced-template-id='t33'] .lekha-original-template.t33-stage .w {
          margin-right: 0 !important;
          font-size: 1em !important;
          line-height: 1.22 !important;
        }

        .lekha-original-template.t40-stage .still-frames-line,
        .lekha-original-template.t40-stage .still-frames-highlight,
        .lekha-original-template.t40-stage .imp-rose,
        .lekha-original-template.t40-stage .is-emphasis {
          opacity: 1 !important;
        }

        .lekha-original-template.t40-stage .still-frames-highlight,
        .lekha-original-template.t40-stage .imp-rose,
        .lekha-original-template.t40-stage .is-emphasis {
          color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
          -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
          text-shadow: 0 0 12px color-mix(in srgb, var(--template-highlight, var(--template-secondary, #f2072b)) 48%, transparent) !important;
        }

        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .lekha-applied-advanced-template,
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .lekha-template-fit,
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .w.in:not([data-imp='true']),
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .kf-base,
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .cluster-row-top,
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .cluster-row-bot,
        .lekha-advanced-template-runtime.has-text-gradient .lekha-original-template .blur-txt {
          background: var(--template-text-gradient) !important;
          background-image: var(--template-text-gradient) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
        }

        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .is-emphasis,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template [data-imp='true'],
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .w.in[data-imp='true'],
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template [data-hero-emphasis='true'],
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-gold,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-rose,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-cyan,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-purple,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-green,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-orange,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-bold,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-italic,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-weight,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-space,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-flicker,
        .lekha-advanced-template-runtime.has-highlight-gradient .lekha-original-template .imp-underline {
          background: var(--template-highlight-gradient) !important;
          background-image: var(--template-highlight-gradient) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
        }

        .lekha-original-template .t23-b3.active .punch-txt {
          animation: punchPop 0.4s cubic-bezier(0.34,1.7,0.64,1) 0.2s forwards;
        }

        @keyframes lekhaTemplateWbwIn {
          to {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }
        }
      `}
    </style>
  );
}

export function SidebarSourceTemplateStyles() {
  return (
    <style>
      {`
        .lekha-sidebar-source-template {
          --sidebar-source-accent: #DDAA03;
          --sidebar-source-muted: rgba(255, 255, 255, 0.58);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          max-width: min(84vw, 430px);
          min-width: 0 !important;
          min-height: 0 !important;
          aspect-ratio: auto !important;
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--sidebar-source-color, #fff);
          text-align: center;
          pointer-events: auto;
        }

        .lekha-sidebar-source-template .stage,
        .lekha-sidebar-source-template .lk-stage {
          position: relative !important;
          inset: auto !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          overflow: visible !important;
          background: transparent !important;
        }

        .lekha-sidebar-source-template .sb,
        .lekha-sidebar-source-template .sblock {
          position: relative !important;
          inset: auto !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          padding: 0 !important;
          opacity: 1 !important;
          overflow: visible !important;
          background: transparent !important;
          pointer-events: auto;
        }

        .lekha-sidebar-source-template .wbw,
        .lekha-sidebar-source-template .wbw-line {
          display: inline-block;
          max-width: min(84vw, 430px);
          line-height: var(--sidebar-source-line-height, 1.25);
          text-align: center;
          white-space: normal;
        }

        .lekha-sidebar-source-template .lekha-sidebar-source-line {
          display: block;
          white-space: normal;
        }

        .lekha-sidebar-source-template .lekha-sidebar-source-line + .lekha-sidebar-source-line {
          margin-top: 0.02em;
        }

        .lekha-sidebar-source-template .w,
        .lekha-sidebar-source-template .wbw-word {
          display: inline-block;
          vertical-align: baseline;
          color: inherit;
          -webkit-text-fill-color: currentColor;
          opacity: 0;
          transform: translateY(22px);
          transform-origin: center center;
          clip-path: inset(0 0 0 0);
          animation: lekhaSidebarSourceWordIn var(--sidebar-source-word-duration, 330ms) cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: var(--sidebar-source-word-delay, 0ms);
          will-change: transform, opacity, clip-path;
        }

        .lekha-sidebar-source-template .wbw.wrise .w,
        .lekha-sidebar-source-template .wbw-line.wrise .wbw-word {
          transform: translateY(22px);
        }

        .lekha-sidebar-source-template .wbw.wslide .w,
        .lekha-sidebar-source-template .wbw-line.wslide .wbw-word {
          transform: translateX(-26px);
        }

        .lekha-sidebar-source-template .wbw.wslider .w,
        .lekha-sidebar-source-template .wbw-line.wslider .wbw-word {
          transform: translateX(26px);
        }

        .lekha-sidebar-source-template .wbw.wroll .w,
        .lekha-sidebar-source-template .wbw-line.wroll .wbw-word {
          transform: translateY(14px) rotate(-6deg);
          transform-origin: left bottom;
        }

        .lekha-sidebar-source-template .wbw.wwipe .w,
        .lekha-sidebar-source-template .wbw-line.wwipe .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(0 100% 0 0);
        }

        .lekha-sidebar-source-template .wbw.wwipeup .w,
        .lekha-sidebar-source-template .wbw-line.wwipeup .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(100% 0 0 0);
        }

        .lekha-sidebar-source-template .wbw.wfade .w,
        .lekha-sidebar-source-template .wbw-line.wfade .wbw-word {
          transform: none;
        }

        .lekha-sidebar-source-template .wbw.wscale .w,
        .lekha-sidebar-source-template .wbw-line.wscale .wbw-word {
          transform: scale(0.5);
        }

        .lekha-sidebar-source-template .wbw.wflip,
        .lekha-sidebar-source-template .wbw-line.wflip {
          perspective: 320px;
        }

        .lekha-sidebar-source-template .wbw.wflip .w,
        .lekha-sidebar-source-template .wbw-line.wflip .wbw-word {
          transform: rotateX(-80deg);
          transform-origin: center bottom;
        }

        .lekha-sidebar-source-template .wbw.wbounce .w,
        .lekha-sidebar-source-template .wbw-line.wbounce .wbw-word {
          transform: translateY(-22px);
        }

        .lekha-sidebar-source-template .wbw.wdiag .w,
        .lekha-sidebar-source-template .wbw-line.wdiag .wbw-word {
          transform: translate(-16px, 16px);
        }

        .lekha-sidebar-source-template .wbw.wexpand .w,
        .lekha-sidebar-source-template .wbw-line.wexpand .wbw-word {
          transform: scaleX(0.15);
          transform-origin: center;
        }

        .lekha-sidebar-source-template .wbw.wskew .w,
        .lekha-sidebar-source-template .wbw-line.wskew .wbw-word {
          transform: skewX(-18deg) translateX(-12px);
        }

        .lekha-sidebar-source-template .wbw.wstencil .w,
        .lekha-sidebar-source-template .wbw-line.wstencil .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(0 50% 0 50%);
        }

        .lekha-sidebar-source-template .wbw.wlift .w,
        .lekha-sidebar-source-template .wbw-line.wlift .wbw-word {
          transform: translateY(-22px);
        }

        .lekha-sidebar-source-template .w.in,
        .lekha-sidebar-source-template .wbw-word.visible {
          opacity: 1;
        }

        .lekha-sidebar-source-template .w.is-current,
        .lekha-sidebar-source-template .wbw-word.is-current {
          color: var(--sidebar-source-accent);
          -webkit-text-fill-color: currentColor;
        }

        .lekha-sidebar-source-template .w.is-emphasis,
        .lekha-sidebar-source-template .wbw-word.is-emphasis,
        .lekha-sidebar-source-template .imp-gold,
        .lekha-sidebar-source-template .ns2-gold,
        .lekha-sidebar-source-template .ns3-gold {
          color: var(--sidebar-source-accent) !important;
          -webkit-text-fill-color: currentColor !important;
          text-shadow: 0 0 14px color-mix(in srgb, var(--sidebar-source-accent) 48%, transparent);
        }

        .lekha-sidebar-source-template .ns2-rose,
        .lekha-sidebar-source-template .ns3-rose,
        .lekha-sidebar-source-template .imp-rose {
          color: #ff3d71 !important;
          -webkit-text-fill-color: currentColor !important;
        }

        .lekha-sidebar-source-template .ns2-cyan,
        .lekha-sidebar-source-template .ns3-cyan,
        .lekha-sidebar-source-template .imp-cyan {
          color: #00e5ff !important;
          -webkit-text-fill-color: currentColor !important;
        }

        .lekha-sidebar-source-template .ns2-purple,
        .lekha-sidebar-source-template .ns3-purple,
        .lekha-sidebar-source-template .imp-purple {
          color: #a78bfa !important;
          -webkit-text-fill-color: currentColor !important;
        }

        @keyframes lekhaSidebarSourceWordIn {
          to {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }
        }
      `}
    </style>
  );
}
