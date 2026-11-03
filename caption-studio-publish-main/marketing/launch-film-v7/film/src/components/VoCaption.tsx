import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, LAYOUT, SIZES } from "../theme";
import { sec, VoLine } from "../timeline";

// The film's own subtitles, drawn like the wordmark: ink letters on a cream box, the key word on
// the amber box. Word timings are spread by word length until the real VO is recorded; then they
// should come from Lekha's own word timings for the VO track.
const wordTimes = (line: VoLine) => {
  const words = line.text.split(/\s+/);
  const weights = words.map((w) => w.replace(/\*/g, "").length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((raw, i) => {
    const start = line.from + ((line.to - line.from) * acc) / total;
    acc += weights[i];
    return {
      raw,
      key: /^\*.*\*[,.—]?$/.test(raw),
      text: raw.replace(/\*/g, ""),
      start,
    };
  });
};

// `nextFrom`: when the next line starts, this one is gone (two captions never stack).
const Line: React.FC<{ line: VoLine; nextFrom?: number }> = ({
  line,
  nextFrom,
}) => {
  const frame = useCurrentFrame();
  const words = wordTimes(line);
  const inF = sec(line.from) - 4;
  const outF = sec(line.to) + 8;
  if (frame < inF || frame > outF + 6) return null;
  if (nextFrom !== undefined && frame >= sec(nextFrom) - 4) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: (LAYOUT.width - LAYOUT.captionMaxWidth) / 2,
        width: LAYOUT.captionMaxWidth,
        bottom: LAYOUT.captionBottom,
        display: "flex",
        justifyContent: "center",
        opacity: interpolate(
          frame,
          [inF, inF + 4, outF, outF + 6],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        ),
        translate: interpolate(frame, [inF, inF + 6], ["0px 10px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <div
        style={{
          background: COLORS.cream,
          color: COLORS.ink,
          borderRadius: SIZES.caption * 0.16,
          padding: `${SIZES.caption * 0.12}px ${SIZES.caption * 0.32}px ${SIZES.caption * 0.18}px`,
          fontFamily: FONTS.display,
          fontWeight: 800,
          fontSize: SIZES.caption,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          textAlign: "center",
        }}
      >
        {words.map((w, i) => {
          const spoken = frame >= sec(w.start);
          const boxOn = w.key && spoken;
          return (
            <React.Fragment key={i}>
              <span
                style={{
                  color: boxOn
                    ? COLORS.cream
                    : spoken
                      ? COLORS.ink
                      : COLORS.stone,
                  background: boxOn ? COLORS.amber : "transparent",
                  borderRadius: SIZES.caption * 0.1,
                  padding: w.key ? "0 0.14em" : 0,
                  margin: w.key ? "0 -0.14em" : 0,
                }}
              >
                {w.text}
              </span>
              {i < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const VoCaptions: React.FC<{ lines: VoLine[] }> = ({ lines }) => (
  <>
    {lines.map((line, i) => (
      <Line key={i} line={line} nextFrom={lines[i + 1]?.from} />
    ))}
  </>
);
