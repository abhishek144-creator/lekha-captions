import fs from "fs"

// The editor canvas is VideoPlayer.jsx plus its extracted rendering, style,
// word-editing and UI modules. Contract checks read them as one source so a
// check keeps passing wherever a declaration lives. Line endings are
// normalised so checks behave the same on Windows checkouts.
export const VIDEO_PLAYER_SOURCE_FILES = [
  "src/components/dashboard/VideoPlayer.jsx",
  "src/components/dashboard/TextElementLayer.jsx",
  "src/components/dashboard/useCanvasTextEditing.js",
  "src/components/dashboard/useCanvasTransforms.js",
  "src/components/dashboard/useWordGestures.js",
  "src/components/dashboard/useDocumentGesture.js",
  "src/components/dashboard/videoPlayerTemplateRendering.jsx",
  "src/components/dashboard/videoPlayerTemplateStyles.jsx",
  "src/components/dashboard/videoPlayerWordEditing.js",
  "src/components/dashboard/sourceTemplateWordGeometry.js",
  "src/components/dashboard/VideoPlayerKeyframes.jsx",
  "src/components/dashboard/CanvasToolRail.jsx",
  "src/components/dashboard/PlaybackControls.jsx",
  "src/components/dashboard/PreviewScrubber.jsx",
  "src/components/dashboard/SelectedWordOutline.jsx",
]

export function readVideoPlayerSource(projectRoot) {
  return VIDEO_PLAYER_SOURCE_FILES
    .map((name) => fs.readFileSync(new URL(name, projectRoot), "utf8").replace(/\r\n/g, "\n"))
    .join("\n")
}
