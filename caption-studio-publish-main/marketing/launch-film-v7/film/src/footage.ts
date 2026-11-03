// Every real recording the film needs. Put the file in public/footage/ and set `src`
// (e.g. "footage/F1-creator.mp4"); until then the film shows a labelled placeholder slate.
import type { TakeLog } from "./components/TakeCursor";
import L1Log from "./footage-logs/L1.json";
import L2Log from "./footage-logs/L2.json";
import L3Log from "./footage-logs/L3.json";

export type FootageId = "F1" | "F2" | "F3" | "F4" | "F4b" | "L1" | "L2" | "L3";

export type Footage = {
  src: string | null;
  // Seconds into the source file where this film's use starts.
  trimStartSec: number;
  what: string;
  who: "founder" | "claude";
  // Cursor log from recorder/record.mjs (headless takes record no pointer; the film draws it).
  cursor?: TakeLog;
};

export const FOOTAGE: Record<FootageId, Footage> = {
  F1: {
    src: null,
    trimStartSec: 0,
    who: "founder",
    what: "Creator speaking one honest line to camera · vertical 9:16 · real voice",
  },
  F2: {
    src: null,
    trimStartSec: 0,
    who: "founder",
    what: "Live app: Upload New → Caption Settings → Generate → captions appear",
  },
  // L1–L3: recorded 29 Oct 2026 from the live release (cf642737) running locally, signed out, on the
  // sample clip and its seeded transcript (L1 seeds "knot" for "not" so a real fix can be shown).
  // Re-record with recorder/record.mjs once F1 exists so the film follows the creator's own line.
  L1: {
    src: "footage/L1.mp4",
    cursor: L1Log,
    trimStartSec: 1.0,
    who: "claude",
    what: "Timeline word chips under the playhead · one word corrected in the caption list",
  },
  L2: {
    src: "footage/L2.mp4",
    cursor: L2Log,
    trimStartSec: 0.2,
    who: "claude",
    what: "Key word dragged out (smart guides) · sized up · warm gradient from the word panel",
  },
  L3: {
    src: "footage/L3.mp4",
    cursor: L3Log,
    trimStartSec: 1.6,
    who: "claude",
    what: "Template gallery cards playing · one click · preview plays the line in the template",
  },
  F3: {
    src: null,
    trimStartSec: 0,
    who: "founder",
    what: "Live app: Translate to… Spanish (+ Arabic, Japanese) · then four language previews",
  },
  F4: {
    src: null,
    trimStartSec: 0,
    who: "founder",
    what: "Live app: Export 1080p to completion · SRT/VTT row visible · downloaded MP4 playing",
  },
  F4b: {
    src: null,
    trimStartSec: 0,
    who: "founder",
    what: "The exported MP4 of the creator clip, styled in Lekha, with its real sound",
  },
};

// The creator's line, word by word. PLACEHOLDER until F1 is recorded — then replace with the
// real transcript and the word timings Lekha itself produces for that clip.
export const CREATOR_LINE = {
  isPlaceholder: true,
  words: ["I", "almost", "didn't", "post", "this."],
  startSec: 0.3,
  endSec: 2.3,
};
