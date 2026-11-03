# Lekha Captions — launch film v7 ("Said, then subtitled.")

Remotion project for the 70 s launch film. Script, storyboard and open questions:
`../PRE-PRODUCTION.md`.

## Where things live

| File | What it controls |
|---|---|
| `src/timeline.ts` | Scene lengths, cross-fades, every voiceover caption line and its timing, chapter labels |
| `src/footage.ts` | The real recordings (F1–F4b from the founder, L1–L3 recorded locally) and the creator's line |
| `src/theme.ts` | Brand colours, fonts (`public/fonts`, from `marketing/brand/fonts`), layout boxes |
| `src/scenes/` | One component per scene (S3–S8 share `StageScenes.tsx`) |
| `src/components/` | Captions (`VoCaption`), footage slot / placeholder slate, chapter label |
| `src/wordmark-data.ts` | Generated from `marketing/brand/svg/lekha-wordmark-dark.svg`; the paths are never edited |

## Adding a real recording

1. Copy the file into `public/footage/` (e.g. `F2-upload.mp4`).
2. In `src/footage.ts` set `src: "footage/F2-upload.mp4"` and `trimStartSec` to where the useful part starts.
3. Add camera keys for that scene in `src/scenes/StageScenes.tsx` if it needs a lean-in.

Until `src` is set, the film shows a dashed "PLACEHOLDER · NOT IN FINAL FILM" slate in that spot.

## Commands

```bash
npm i
npx remotion studio                                   # preview; every scene is also its own composition
npx remotion render LaunchFilm out/lekha-v7-animatic-draft.mp4 --scale=0.5 --muted   # quick draft
npx remotion still LaunchFilm out/stills/f1990.png --frame=1990 --scale=0.5          # one frame
```

Final render (after VO and music exist): 1920×1080, H.264, yuv420p, AAC 256 kbps, then loudness to
−14 LUFS / −1 dBTP as in `marketing/README.md`.

## Re-recording the local takes (L1–L3)

`../recorder/record.mjs` drives the real editor in a headless browser and writes
`recorder/takes/L1.mp4` (and L2, L3). It expects the **live release** running locally on port 3170:
a clean `git worktree` of the release commit with `npm ci` and `public/dev-sample.mov`, started with
`npx vite --port 3170`. Copy finished takes into `public/footage/`. When the creator clip (F1) exists,
put it in that worktree as `public/dev-sample.mov` and its transcript in `recorder/session.mjs`
(`CAPTIONS`), then re-record so S4–S6 follow the creator's own line.
