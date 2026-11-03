import React from "react";
import { Video } from "@remotion/media";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FOOTAGE, FootageId } from "../footage";
import { TakeCursor } from "./TakeCursor";
import { COLORS, FONTS } from "../theme";
import { FPS } from "../timeline";

// Camera keyframes on a recording: zoom 1 = the whole frame; x/y = the point (0–1) kept centred.
export type CameraKey = { at: number; zoom: number; x: number; y: number };

const clampCentre = (c: number, zoom: number) =>
  Math.min(1 - 0.5 / zoom, Math.max(0.5 / zoom, c));

const cameraAt = (frame: number, keys: CameraKey[]) => {
  if (keys.length === 0) return { zoom: 1, x: 0.5, y: 0.5 };
  if (keys.length === 1) return keys[0];
  const frames = keys.map((k) => k.at * FPS);
  const opts = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  } as const;
  return {
    zoom: interpolate(
      frame,
      frames,
      keys.map((k) => k.zoom),
      opts,
    ),
    x: interpolate(
      frame,
      frames,
      keys.map((k) => k.x),
      opts,
    ),
    y: interpolate(
      frame,
      frames,
      keys.map((k) => k.y),
      opts,
    ),
  };
};

type Props = {
  id: FootageId;
  box: { x: number; y: number; w: number; h: number };
  camera?: CameraKey[];
  muted?: boolean;
  // Per-frame volume (frame counted from this slot's start), e.g. to cut the sound in S1.
  volume?: (frame: number) => number;
  radius?: number;
  // Drawn on top of the footage/slate (e.g. the creator's caption in S1).
  children?: React.ReactNode;
};

export const FootageSlot: React.FC<Props> = ({
  id,
  box,
  camera = [],
  muted = true,
  volume,
  radius = 14,
  children,
}) => {
  const frame = useCurrentFrame();
  const clip = FOOTAGE[id];
  const cam = cameraAt(frame, camera);

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: radius,
        overflow: "hidden",
        background: COLORS.slate,
      }}
    >
      {clip.src ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            // Scale from the top-left, then move the chosen point to the centre of the box.
            // The point is clamped so the recording always covers the whole box.
            transformOrigin: "0 0",
            scale: String(cam.zoom),
            translate: `${(0.5 - clampCentre(cam.x, cam.zoom) * cam.zoom) * 100}% ${(0.5 - clampCentre(cam.y, cam.zoom) * cam.zoom) * 100}%`,
          }}
        >
          <Video
            src={staticFile(clip.src)}
            trimBefore={Math.round(clip.trimStartSec * FPS)}
            muted={muted}
            volume={volume}
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
          {clip.cursor ? (
            <TakeCursor
              take={clip.cursor}
              timeSec={clip.trimStartSec + frame / FPS}
              boxW={box.w}
              boxH={box.h}
            />
          ) : null}
        </div>
      ) : (
        <Slate
          id={id}
          what={clip.what}
          who={clip.who}
          frame={frame}
          portrait={box.h > box.w}
        />
      )}
      {children}
    </div>
  );
};

// A placeholder that can never be mistaken for the product: dashed frame, slot id, what to record.
const Slate: React.FC<{
  id: string;
  what: string;
  who: string;
  frame: number;
  portrait: boolean;
}> = ({ id, what, who, frame, portrait }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      border: `3px dashed ${COLORS.stone}`,
      borderRadius: 14,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: portrait ? 18 : 22,
      padding: portrait ? 34 : 80,
      textAlign: "center",
      fontFamily: FONTS.mono,
      fontWeight: 700,
      color: COLORS.stone,
    }}
  >
    <div style={{ fontSize: portrait ? 20 : 24, letterSpacing: "0.2em" }}>
      PLACEHOLDER · NOT IN FINAL FILM
    </div>
    <div
      style={{
        fontFamily: FONTS.display,
        fontWeight: 800,
        fontSize: portrait ? 96 : 140,
        color: COLORS.cream,
        lineHeight: 1,
      }}
    >
      {id}
    </div>
    <div
      style={{
        fontSize: portrait ? 22 : 30,
        lineHeight: 1.4,
        color: COLORS.cream,
        maxWidth: 1000,
      }}
    >
      {what}
    </div>
    <div style={{ fontSize: portrait ? 18 : 22, letterSpacing: "0.12em" }}>
      {who === "founder"
        ? "TO BE RECORDED BY THE FOUNDER"
        : "TO BE RECORDED LOCALLY BY CLAUDE"}{" "}
      · {(frame / FPS).toFixed(1)} s
    </div>
  </div>
);
