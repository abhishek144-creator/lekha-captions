import React from 'react'

const BRAND_KIT_MESSAGES = {
  conflict: 'Brand kits changed on another device. Browser edits are preserved. Export your kits in Layers before reloading.',
  'storage-full': 'Browser storage is unavailable. Keep this page open until account sync succeeds.',
  local: 'Brand kit changes are waiting for account sync.',
}

// Persistent banners for problems that need the customer's action.
export default function EditorStatusBanners({
  sourceUnavailable,
  isRelinking,
  onRelinkSource,
  brandKitSyncStatus,
  onRetryBrandKitSync,
  onReloadBrandKits,
}) {
  const brandKitMessage = BRAND_KIT_MESSAGES[brandKitSyncStatus]
  return (
    <>
      {sourceUnavailable && (
        <div role="status" className="flex flex-wrap items-center gap-3 bg-amber-950 px-4 py-2 text-xs text-amber-100">
          <span>Source video unavailable. Captions remain editable. Relink the original video; verify timing if you choose another version.</span>
          <label className="cursor-pointer underline">
            {isRelinking ? 'Uploading source…' : 'Relink source video'}
            <input
              aria-label="Relink source video"
              type="file"
              accept="video/*"
              disabled={isRelinking}
              className="sr-only"
              onChange={(event) => { onRelinkSource(event.target.files?.[0]); event.target.value = '' }}
            />
          </label>
        </div>
      )}
      {brandKitMessage && (
        <div role="status" className="flex flex-wrap gap-3 bg-sky-950 px-4 py-2 text-xs text-sky-100">
          <span>{brandKitMessage}</span>
          <button type="button" onClick={onRetryBrandKitSync} className="underline">Retry sync</button>
          <button type="button" onClick={onReloadBrandKits} className="underline">Reload cloud preferences</button>
        </div>
      )}
    </>
  )
}
