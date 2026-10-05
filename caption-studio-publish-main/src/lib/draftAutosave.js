// Compare saved editor content, excluding expiring media URLs and assigned IDs.
export function draftAutosaveSignature(draft) {
  return JSON.stringify({
    captions: draft.captions,
    captionTracks: (draft.captionTracks || []).map((track) => (
      track.id === draft.activeCaptionTrackId ? { ...track, captions: draft.captions } : track
    )),
    activeCaptionTrackId: draft.activeCaptionTrackId,
    captionStyle: draft.captionStyle,
    duration: draft.duration,
    fileId: draft.fileId,
    originalFileName: draft.originalFileName,
    settings: draft.settings,
  })
}
