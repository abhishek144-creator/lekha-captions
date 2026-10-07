import fs from "fs"
import path from "path"

// Dashboard.jsx delegates its draft persistence, document state, history and
// notice/empty-state UI to these modules. Contract checks read them together
// so a check keeps passing when code moves between them. Line endings are
// normalised so checks behave the same on Windows checkouts.
export const DASHBOARD_SOURCE_FILES = [
  "src/pages/Dashboard.jsx",
  "src/hooks/useDraftPersistence.js",
  "src/hooks/useEditorDocument.js",
  "src/hooks/useEditorHistory.js",
  "src/lib/editorDocument.js",
  "src/lib/localDraftStorage.js",
  "src/lib/templateApplication.js",
  "src/lib/transcriptTracks.js",
  "src/lib/wordStyleEdits.js",
  "src/components/dashboard/EditorEmptyState.jsx",
  "src/components/dashboard/EditorNotices.jsx",
  "src/components/dashboard/EditorStatusBanners.jsx",
  "src/components/dashboard/GeneratingCaptionsScreen.jsx",
  "src/components/dashboard/TimelineResizeHandle.jsx",
]

export function readDashboardSource(root) {
  return DASHBOARD_SOURCE_FILES
    .map((name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n"))
    .join("\n")
}
