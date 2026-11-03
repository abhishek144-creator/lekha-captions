import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, SIZES } from "../theme";
import { Scene } from "../timeline";
import { VoCaptions } from "./VoCaption";

// Small chapter mark in the left margin: italic numeral over a mono word. Never over footage.
export const ChapterLabel: React.FC<{
  number: string;
  word: string;
  enter?: boolean;
}> = ({ number, word, enter = true }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 64,
        opacity: enter
          ? interpolate(frame, [6, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1,
        translate: enter
          ? interpolate(frame, [6, 18], ["0px 12px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })
          : "0px 0px",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.accent,
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: SIZES.chapterNumber,
          color: COLORS.amber,
          lineHeight: 1,
        }}
      >
        {number}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: SIZES.chapterWord,
          letterSpacing: "0.22em",
          color: COLORS.stone,
        }}
      >
        {word}
      </div>
    </div>
  );
};

// Ink background + chapter label + VO captions, shared by every scene.
export const SceneFrame: React.FC<{
  scene: Scene;
  chapterEnters?: boolean;
  children: React.ReactNode;
}> = ({ scene, chapterEnters = true, children }) => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    {children}
    {scene.chapter ? (
      <ChapterLabel {...scene.chapter} enter={chapterEnters} />
    ) : null}
    <VoCaptions lines={scene.vo} />
  </AbsoluteFill>
);
