import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { SceneId, SCENES, sceneFrames } from "./timeline";
import { S01Hook } from "./scenes/S01Hook";
import { S02Problem } from "./scenes/S02Problem";
import {
  S03Upload,
  S04Edit,
  S05Word,
  S06Template,
  S07Translate,
  S08Export,
} from "./scenes/StageScenes";
import { S09Payoff } from "./scenes/S09Payoff";
import { S10Reveal } from "./scenes/S10Reveal";

export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  S01Hook,
  S02Problem,
  S03Upload,
  S04Edit,
  S05Word,
  S06Template,
  S07Translate,
  S08Export,
  S09Payoff,
  S10Reveal,
};

// "Said, then subtitled." — the 70 s launch film. Lengths and fades come from timeline.ts.
export const LaunchFilm: React.FC = () => (
  <TransitionSeries>
    {SCENES.map((scene) => {
      const Component = SCENE_COMPONENTS[scene.id];
      return (
        <React.Fragment key={scene.id}>
          <TransitionSeries.Sequence
            name={scene.id}
            durationInFrames={sceneFrames(scene)}
          >
            <Component />
          </TransitionSeries.Sequence>
          {scene.fadeOut > 0 ? (
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: scene.fadeOut })}
            />
          ) : null}
        </React.Fragment>
      );
    })}
  </TransitionSeries>
);
