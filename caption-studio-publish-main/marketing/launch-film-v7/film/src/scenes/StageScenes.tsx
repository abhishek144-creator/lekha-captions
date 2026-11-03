import React from "react";
import { CameraKey, FootageSlot } from "../components/FootageSlot";
import { SceneFrame } from "../components/Chrome";
import { FootageId } from "../footage";
import { LAYOUT } from "../theme";
import { SceneId, sceneById } from "../timeline";

// S3–S8 all show one real screen recording on the stage. Camera keys are placeholders until the
// recordings exist; the rule is: lean in (≤1.35×) only around a click, then back to full frame.
const StageScene: React.FC<{
  id: SceneId;
  footage: FootageId;
  camera?: CameraKey[];
  chapterEnters: boolean;
}> = ({ id, footage, camera, chapterEnters }) => (
  <SceneFrame scene={sceneById(id)} chapterEnters={chapterEnters}>
    <FootageSlot id={footage} box={LAYOUT.stage} camera={camera} />
  </SceneFrame>
);

export const S03Upload: React.FC = () => (
  <StageScene id="S03Upload" footage="F2" chapterEnters />
);
// Camera keys: `at` = seconds into the scene; x/y = the point of the recording (0–1) brought to
// the centre. Leans go past 1.35× only where small UI text has to be read (caption list, captions).
export const S04Edit: React.FC = () => (
  <StageScene
    id="S04Edit"
    footage="L1"
    chapterEnters={false}
    camera={[
      { at: 0, zoom: 1, x: 0.5, y: 0.5 },
      { at: 1.0, zoom: 1, x: 0.5, y: 0.5 },
      { at: 1.8, zoom: 1.6, x: 0.34, y: 0.39 }, // caption list + preview while the word is fixed
      { at: 4.4, zoom: 1.6, x: 0.34, y: 0.39 },
      { at: 5.3, zoom: 1, x: 0.5, y: 0.5 }, // back out: the corrected line plays over the timeline
    ]}
  />
);
export const S05Word: React.FC = () => (
  <StageScene
    id="S05Word"
    footage="L2"
    chapterEnters
    camera={[
      { at: 0, zoom: 1, x: 0.5, y: 0.5 },
      { at: 0.5, zoom: 1.45, x: 0.52, y: 0.62 }, // the word leaves the line
      { at: 2.3, zoom: 1.45, x: 0.52, y: 0.62 },
      { at: 3.1, zoom: 1.35, x: 0.6, y: 0.42 }, // preview + word panel beside it
      { at: 6.9, zoom: 1.35, x: 0.6, y: 0.42 },
      { at: 7.6, zoom: 1.45, x: 0.52, y: 0.62 }, // the styled word plays
    ]}
  />
);
export const S06Template: React.FC = () => (
  <StageScene
    id="S06Template"
    footage="L3"
    chapterEnters={false}
    camera={[
      { at: 0, zoom: 1, x: 0.5, y: 0.5 },
      { at: 0.6, zoom: 1.4, x: 0.36, y: 0.45 }, // gallery cards playing + preview
      { at: 3.9, zoom: 1.4, x: 0.36, y: 0.45 },
      { at: 4.6, zoom: 1.7, x: 0.52, y: 0.7 }, // the line in the template, key word highlighted
    ]}
  />
);
export const S07Translate: React.FC = () => (
  <StageScene id="S07Translate" footage="F3" chapterEnters />
);
export const S08Export: React.FC = () => (
  <StageScene id="S08Export" footage="F4" chapterEnters={false} />
);
