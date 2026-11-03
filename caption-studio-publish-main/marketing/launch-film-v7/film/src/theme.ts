// Brand look for the whole film. Colours and fonts come from marketing/brand (see marketing/README.md).
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const COLORS = {
  ink: "#0C0B0F",
  cream: "#FFFAF3",
  amber: "#C27A29",
  stone: "#8A8478",
  // Placeholder slates only — never used for finished shots.
  slate: "#17151B",
};

export const FONTS = {
  display: "Bricolage Grotesque",
  mono: "JetBrains Mono",
  accent: "Fraunces",
};

loadFont({
  family: FONTS.display,
  url: staticFile("fonts/BricolageGrotesque96pt-ExtraBold.ttf"),
  weight: "800",
});
loadFont({
  family: FONTS.mono,
  url: staticFile("fonts/JetBrainsMono-Bold.ttf"),
  weight: "700",
});
loadFont({
  family: FONTS.accent,
  url: staticFile("fonts/Fraunces144pt-SemiBoldItalic.ttf"),
  weight: "600",
  style: "italic",
});

export const SIZES = {
  caption: 60, // VO captions (≈12 px on a 390 px-wide phone)
  chapterNumber: 64,
  chapterWord: 26,
  label: 26,
};

// Where things sit on the 1920×1080 frame. Footage never sits under text.
export const LAYOUT = {
  width: 1920,
  height: 1080,
  stage: { x: 240, y: 50, w: 1440, h: 810 }, // UI recordings, 16:9
  portrait: { x: 960 - 461 / 2, y: 40, w: 461, h: 820 }, // creator clip, 9:16
  captionBottom: 100,
  captionMaxWidth: 1500,
};
