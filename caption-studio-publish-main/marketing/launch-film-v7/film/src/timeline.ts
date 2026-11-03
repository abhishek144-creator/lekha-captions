// The edit in one place: scene lengths, transitions, voiceover lines and chapter labels.
// Times are seconds inside each scene. Re-timing the film = changing numbers here.

export const FPS = 30;

export type SceneId =
  | "S01Hook"
  | "S02Problem"
  | "S03Upload"
  | "S04Edit"
  | "S05Word"
  | "S06Template"
  | "S07Translate"
  | "S08Export"
  | "S09Payoff"
  | "S10Reveal";

// A VO line. Wrap a word in *asterisks* to put it on the amber box when it is spoken.
export type VoLine = { text: string; from: number; to: number };

export type Scene = {
  id: SceneId;
  seconds: number;
  // Cross-fade into the NEXT scene, in frames (0 = hard cut). The overlap is added to this
  // scene so every scene still starts at the timecode in PRE-PRODUCTION.md.
  fadeOut: number;
  vo: VoLine[];
  chapter?: { number: string; word: string };
};

export const SCENES: Scene[] = [
  {
    id: "S01Hook",
    seconds: 6,
    fadeOut: 0,
    vo: [{ text: "Not everyone will hear you.", from: 3.2, to: 5.3 }],
  },
  {
    id: "S02Problem",
    seconds: 8,
    fadeOut: 10,
    vo: [
      {
        text: "Everyone can *read* you — if the captions are right.",
        from: 0.3,
        to: 3.4,
      },
      // Split so every caption stays on one line and never reaches the footage above it.
      { text: "That usually means typing,", from: 3.8, to: 5.2 },
      { text: "re-timing and styling every line by hand.", from: 5.4, to: 7.6 },
    ],
  },
  {
    id: "S03Upload",
    seconds: 10,
    fadeOut: 0,
    chapter: { number: "01", word: "WORDS" },
    vo: [
      { text: "With Lekha Captions, you upload once.", from: 0.6, to: 2.9 },
      { text: "It listens, and writes every word —", from: 3.6, to: 5.9 },
      { text: "timed to your *voice*.", from: 6.0, to: 7.6 },
    ],
  },
  {
    id: "S04Edit",
    seconds: 7,
    fadeOut: 0,
    chapter: { number: "01", word: "WORDS" },
    vo: [
      // "line", not "word": the timeline shows whole caption lines (checked in the live release)
      { text: "Every line sits on the timeline,", from: 0.4, to: 2.4 },
      { text: "so a fix takes *seconds*.", from: 2.5, to: 4.2 },
    ],
  },
  {
    id: "S05Word",
    seconds: 8,
    fadeOut: 8,
    chapter: { number: "02", word: "VOICE" },
    vo: [
      { text: "Then make it sound like *you*.", from: 0.4, to: 2.2 },
      { text: "Lift the one word that *matters* —", from: 2.7, to: 4.6 },
      { text: "and put it *anywhere*.", from: 4.7, to: 6.2 },
    ],
  },
  {
    id: "S06Template",
    seconds: 7,
    fadeOut: 0,
    chapter: { number: "02", word: "VOICE" },
    vo: [
      { text: "Or choose a complete look in one click —", from: 0.6, to: 3.2 },
      // timed to the take: the highlighted word ("not") appears ~5.5 s into the scene
      { text: "your key words already *highlighted*.", from: 3.9, to: 6.0 },
    ],
  },
  {
    id: "S07Translate",
    seconds: 8,
    fadeOut: 0,
    chapter: { number: "03", word: "WORLD" },
    vo: [
      {
        text: "Translate into more than a hundred *languages*,",
        from: 0.4,
        to: 3.3,
      },
      { text: "and your *style* comes with you.", from: 3.4, to: 5.4 },
    ],
  },
  {
    id: "S08Export",
    seconds: 5,
    fadeOut: 10,
    chapter: { number: "03", word: "WORLD" },
    vo: [
      { text: "Export in HD or *4K* —", from: 0.2, to: 1.8 },
      { text: "or take the subtitle file with you.", from: 1.9, to: 4.0 },
    ],
  },
  {
    id: "S09Payoff",
    seconds: 6,
    fadeOut: 0,
    vo: [
      { text: "Your *words*. Your *voice*. Your *world*.", from: 2.6, to: 5.6 },
    ],
  },
  {
    id: "S10Reveal",
    seconds: 5,
    fadeOut: 0,
    // The VO "Lekha Captions. Try it free." is captioned by the wordmark itself and the CTA.
    vo: [],
  },
];

export const sceneFrames = (scene: Scene) =>
  Math.round(scene.seconds * FPS) + scene.fadeOut;

export const sceneById = (id: SceneId) => {
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown scene ${id}`);
  return scene;
};

// Overlaps cancel out, so the film runs exactly the sum of the scene lengths (70 s).
export const TOTAL_FRAMES = SCENES.reduce(
  (sum, s) => sum + Math.round(s.seconds * FPS),
  0,
);

export const sec = (s: number) => Math.round(s * FPS);
