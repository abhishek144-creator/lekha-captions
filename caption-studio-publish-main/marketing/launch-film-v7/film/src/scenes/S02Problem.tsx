import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { FootageSlot } from "../components/FootageSlot";
import { SceneFrame } from "../components/Chrome";
import { CREATOR_LINE } from "../footage";
import { COLORS, FONTS } from "../theme";
import { sceneById, sec } from "../timeline";
import { PlainCreatorCaption } from "./S01Hook";

// The "before": a hand-typed subtitle file (generic text, not any app's UI), then a caption that
// runs late in a default font. An honest dramatisation of the problem.
const PANEL = { x: 150, y: 150, w: 760, h: 560 };
const CLIP = { x: 1060, y: 40, w: 461, h: 820 };
const CLIP_IN = 3.6;

const srtText = () => {
  const w = CREATOR_LINE.words;
  return [
    "1",
    "00:00:00,300 --> 00:00:01,400",
    w.slice(0, 3).join(" "),
    "",
    "2",
    "00:00:01,400 --> 00:00:02,300",
    "most " + w.slice(4).join(" "),
  ].join("\n");
};

const TYPED_END = 2.4;
const FIX_START = 2.6;
const FIX_END = 3.4;

const typedAt = (frame: number) => {
  const full = srtText();
  const fixed = full.replace(/most (?=[^\n]*$)/, CREATOR_LINE.words[3] + " ");
  if (frame < sec(FIX_START)) {
    return full.slice(
      0,
      Math.floor(
        (full.length * Math.min(frame, sec(TYPED_END))) / sec(TYPED_END),
      ),
    );
  }
  // Backspace "most", then type the right word.
  const wrongAt = full.lastIndexOf("most");
  const steps = Math.floor(
    interpolate(frame, [sec(FIX_START), sec(FIX_END)], [0, 8], {
      extrapolateRight: "clamp",
    }),
  );
  if (steps <= 4) return full.slice(0, wrongAt + 4 - steps);
  return (
    fixed.slice(0, wrongAt + (steps - 4)) +
    (steps >= 8 ? fixed.slice(wrongAt + 4) : "")
  );
};

export const S02Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = sceneById("S02Problem");
  const text = typedAt(frame);
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  const clipOpacity = interpolate(
    frame,
    [sec(CLIP_IN), sec(CLIP_IN) + 10],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <SceneFrame scene={scene}>
      <div
        style={{
          position: "absolute",
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1.55,
          color: COLORS.cream,
          whiteSpace: "pre-wrap",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.2em",
            color: COLORS.stone,
            marginBottom: 24,
          }}
        >
          captions.srt
        </div>
        {text}
        <span style={{ opacity: cursorOn ? 1 : 0, color: COLORS.amber }}>
          ▍
        </span>
      </div>

      <div style={{ position: "absolute", inset: 0, opacity: clipOpacity }}>
        <FootageSlot id="F1" box={CLIP}>
          {/* Half a second late, default font: the problem, not the product */}
          <PlainCreatorCaption
            startSec={CLIP_IN + 0.3}
            lagSec={0.5}
            font="Arial, Helvetica, sans-serif"
            size={30}
          />
        </FootageSlot>
      </div>

      {(["typing", "timing", "styling"] as const).map((word, i) => {
        const at = sec(4.6 + i * 0.65);
        return (
          <div
            key={word}
            style={{
              position: "absolute",
              left: CLIP.x + CLIP.w + 48,
              top: 300 + i * 74,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: "0.06em",
              color: COLORS.stone,
              opacity: interpolate(frame, [at, at + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [at, at + 8],
                ["-10px 0px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            {word}
          </div>
        );
      })}
    </SceneFrame>
  );
};
