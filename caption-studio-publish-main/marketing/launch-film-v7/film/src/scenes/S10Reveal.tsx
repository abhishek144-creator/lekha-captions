import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { WORDMARK } from "../wordmark-data";

// The official wordmark (marketing/brand/svg/lekha-wordmark-dark.svg, paths unchanged) first
// appears at subtitle size where the film's captions sit — two burned-in lines — then rises to
// centre and the quotation marks arrive. Only position, scale, a wipe and opacity are animated.
const [vbX, vbY, vbW, vbH] = WORDMARK.viewBox;
const [lekhaBox, captionsBox] = WORDMARK.rects;
const [lekhaText, captionsText, openQuote, closeQuote] = WORDMARK.paths;

const FINAL_W = 1100;
const FINAL_H = (vbH / vbW) * FINAL_W;
const FINAL_CENTER_Y = 450;
// At the start the "lekha" box is caption-height (≈92 px) and the pair sits on the caption line.
const START_SCALE = 92 / (lekhaBox.h * (FINAL_W / vbW));
const START_CENTER_Y =
  LAYOUT.height - LAYOUT.captionBottom - (FINAL_H * START_SCALE) / 2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const RISE = Easing.bezier(0.65, 0, 0.25, 1);

export const S10Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const wipe1 = interpolate(frame, [0, 9], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const wipe2 = interpolate(frame, [5, 14], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const quotes = interpolate(frame, [36, 52], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <div
        style={{
          position: "absolute",
          left: (LAYOUT.width - FINAL_W) / 2,
          top: FINAL_CENTER_Y - FINAL_H / 2,
          width: FINAL_W,
          height: FINAL_H,
          scale: interpolate(frame, [16, 44], [START_SCALE, 1], {
            ...clamp,
            easing: RISE,
          }),
          translate: interpolate(
            frame,
            [16, 44],
            [`0px ${START_CENTER_Y - FINAL_CENTER_Y}px`, "0px 0px"],
            {
              ...clamp,
              easing: RISE,
            },
          ),
        }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          width={FINAL_W}
          height={FINAL_H}
          role="img"
          aria-label="Lekha Captions"
        >
          <defs>
            <clipPath id="wipe-lekha">
              <rect
                x={lekhaBox.x}
                y={lekhaBox.y}
                width={lekhaBox.w * wipe1}
                height={lekhaBox.h}
              />
            </clipPath>
            <clipPath id="wipe-captions">
              <rect
                x={captionsBox.x}
                y={captionsBox.y}
                width={captionsBox.w * wipe2}
                height={captionsBox.h}
              />
            </clipPath>
          </defs>
          <g clipPath="url(#wipe-lekha)">
            <rect
              x={lekhaBox.x}
              y={lekhaBox.y}
              width={lekhaBox.w}
              height={lekhaBox.h}
              rx={lekhaBox.rx}
              fill={lekhaBox.fill}
            />
            <path d={lekhaText.d} fill={lekhaText.fill} />
          </g>
          <g clipPath="url(#wipe-captions)">
            <rect
              x={captionsBox.x}
              y={captionsBox.y}
              width={captionsBox.w}
              height={captionsBox.h}
              rx={captionsBox.rx}
              fill={captionsBox.fill}
            />
            <path d={captionsText.d} fill={captionsText.fill} />
          </g>
          <g opacity={quotes} transform={`translate(${(1 - quotes) * 120} 0)`}>
            <path d={openQuote.d} fill={openQuote.fill} />
          </g>
          <g opacity={quotes} transform={`translate(${(quotes - 1) * 120} 0)`}>
            <path d={closeQuote.d} fill={closeQuote.fill} />
          </g>
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          top: 720,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [58, 72], [0, 1], clamp),
          translate: interpolate(frame, [58, 74], ["0px 14px", "0px 0px"], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <div
          style={{
            background: COLORS.cream,
            color: COLORS.ink,
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 48,
            letterSpacing: "-0.02em",
            padding: "10px 30px 14px",
            borderRadius: 10,
          }}
        >
          Try it free
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 40,
            color: COLORS.cream,
          }}
        >
          lekhacaptions.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
