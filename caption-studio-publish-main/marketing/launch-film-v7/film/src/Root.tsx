import React from "react";
import { Composition, Folder } from "remotion";
import { LaunchFilm, SCENE_COMPONENTS } from "./LaunchFilm";
import { LAYOUT } from "./theme";
import { FPS, SCENES, sceneFrames, TOTAL_FRAMES } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LaunchFilm"
      component={LaunchFilm}
      width={LAYOUT.width}
      height={LAYOUT.height}
      fps={FPS}
      durationInFrames={TOTAL_FRAMES}
    />
    {/* Each scene on its own, for previewing and re-timing in Remotion Studio */}
    <Folder name="Scenes">
      {SCENES.map((scene) => (
        <Composition
          key={scene.id}
          id={scene.id}
          component={SCENE_COMPONENTS[scene.id]}
          width={LAYOUT.width}
          height={LAYOUT.height}
          fps={FPS}
          durationInFrames={sceneFrames(scene)}
        />
      ))}
    </Folder>
  </>
);
