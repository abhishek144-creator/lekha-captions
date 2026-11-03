import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FootageSlot } from "../components/FootageSlot";
import { SceneFrame } from "../components/Chrome";
import { CREATOR_LINE } from "../footage";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { sceneById, sec } from "../timeline";

const SOUND_CUT = 2.6;

// A plain caption that follows the creator word by word — the "before styling" look.
export const PlainCreatorCaption: React.FC<{
  startSec: number;
  lagSec?: number;
  font?: string;
  size?: number;
}> = ({ startSec, lagSec = 0, font = FONTS.display, size = 34 }) => {
  const frame = useCurrentFrame();
  const { words, endSec } = CREATOR_LINE;
  const span = endSec - CREATOR_LINE.startSec;
  const shown = words.filter(
    (_, i) => frame >= sec(startSec + lagSec + (span * i) / words.length),
  ).length;
  if (shown === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        bottom: "24%",
        textAlign: "center",
        fontFamily: font,
        fontWeight: font === FONTS.display ? 800 : 400,
        fontSize: size,
        lineHeight: 1.15,
        color: "#FFFFFF",
        textShadow: "0 2px 10px rgba(0,0,0,0.55)",
      }}
    >
      {words.slice(0, shown).join(" ")}
    </div>
  );
};

export const S01Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = sceneById("S01Hook");
  return (
    <SceneFrame scene={scene}>
      {/* 8 frames of black before the creator appears */}
      <div
        style={{ position: "absolute", inset: 0, opacity: frame < 8 ? 0 : 1 }}
      >
        <FootageSlot
          id="F1"
          box={LAYOUT.portrait}
          muted={false}
          volume={(f) => (f < sec(SOUND_CUT) ? 1 : 0)}
        >
          <PlainCreatorCaption startSec={CREATOR_LINE.startSec} />
        </FootageSlot>
      </div>
      <div
        style={{
          position: "absolute",
          left: LAYOUT.portrait.x + LAYOUT.portrait.w + 36,
          top: LAYOUT.portrait.y + LAYOUT.portrait.h - 40,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.22em",
          color: COLORS.stone,
          opacity: interpolate(
            frame,
            [sec(SOUND_CUT) + 2, sec(SOUND_CUT) + 8],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        SOUND OFF
      </div>
    </SceneFrame>
  );
};
