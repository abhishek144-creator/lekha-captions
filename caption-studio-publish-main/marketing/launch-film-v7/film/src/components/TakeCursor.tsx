import React from "react";
import { interpolate } from "remotion";
import { COLORS } from "../theme";

// Headless Chrome records no pointer, so the recorder logs every move and click (recorder/record.mjs)
// and the film draws it back: an arrow at the logged position plus a soft ring on each click.
export type TakeLog = {
  view: { width: number; height: number };
  log: { t: number; kind: string; x: number; y: number; visible?: number }[];
};

const MOVES = new Set(["cursor", "down", "up"]);
const RING_SEC = 0.42;

export const TakeCursor: React.FC<{
  take: TakeLog;
  timeSec: number;
  boxW: number;
  boxH: number;
}> = ({ take, timeSec, boxW, boxH }) => {
  const moves = take.log.filter((e) => MOVES.has(e.kind) || e.kind === "click");
  let prev: (typeof moves)[number] | null = null;
  let next: (typeof moves)[number] | null = null;
  for (const e of moves) {
    if (e.t <= timeSec) prev = e;
    else {
      next = e;
      break;
    }
  }
  if (!prev || prev.visible === 0) return null;
  const k =
    next && next.t > prev.t
      ? Math.min(1, (timeSec - prev.t) / (next.t - prev.t))
      : 0;
  const x =
    prev.x +
    ((next?.x ?? prev.x) - prev.x) * (next && next.t - prev.t < 0.2 ? k : 0);
  const y =
    prev.y +
    ((next?.y ?? prev.y) - prev.y) * (next && next.t - prev.t < 0.2 ? k : 0);
  const sx = boxW / take.view.width;
  const sy = boxH / take.view.height;
  const size = boxW * 0.019;
  const rings = take.log.filter(
    (e) =>
      (e.kind === "click" || e.kind === "down") &&
      timeSec >= e.t &&
      timeSec < e.t + RING_SEC,
  );

  return (
    <>
      {rings.map((r, i) => {
        const p = (timeSec - r.t) / RING_SEC;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: r.x * sx - size,
              top: r.y * sy - size,
              width: size * 2,
              height: size * 2,
              borderRadius: "50%",
              border: `${Math.max(2, size * 0.12)}px solid ${COLORS.amber}`,
              scale: String(interpolate(p, [0, 1], [0.5, 1.5])),
              opacity: interpolate(p, [0, 1], [0.85, 0]),
            }}
          />
        );
      })}
      <svg
        viewBox="0 0 34 34"
        width={size}
        height={size}
        style={{
          position: "absolute",
          left: x * sx - size * 0.15,
          top: y * sy - size * 0.09,
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.55))",
        }}
      >
        <path
          d="M5 3l22 13-9.5 2.2L13 28z"
          fill="#fff"
          stroke={COLORS.ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
