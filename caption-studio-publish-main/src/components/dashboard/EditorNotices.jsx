import React from 'react'
import DismissibleNotice from './DismissibleNotice'

const noticeClass = 'pointer-events-auto rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur'
const warningClass = `${noticeClass} flex-wrap border border-amber-300/25 bg-[#1a1608]/95 text-xs text-amber-50`
const neutralClass = `${noticeClass} border border-white/15 bg-[#111]/95`
const actionButtonClass = 'shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60'

// Notices float above the editor and never consume dashboard height.
export default function EditorNotices({
  saveConflict,
  saveMessage,
  translationNotice,
  onDismissTranslation,
  lowCreditOffer,
  onTopUp,
  showCaptionRetry,
  onRetryCaptions,
  retryDisabled,
  onDownloadDraft,
}) {
  if (!saveConflict && !saveMessage && !translationNotice && !lowCreditOffer && !showCaptionRetry) return null
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.25rem] z-[70] mx-auto flex max-w-[1320px] flex-col gap-2" aria-live="polite">
      {saveConflict && (
        <DismissibleNotice closeLabel="Close save conflict notification" className={warningClass}>
          <p role="status">A newer version of this project was saved on another tab or device, so this tab stopped saving to your account. Your edits are kept in this browser.</p>
          <div className="flex shrink-0 gap-3">
            {onDownloadDraft && <button type="button" className="underline" onClick={onDownloadDraft}>Download draft</button>}
            <button type="button" className="underline" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </DismissibleNotice>
      )}
      {saveMessage && (
        <DismissibleNotice key={saveMessage} closeLabel="Close save notification" className={`${neutralClass} text-xs text-gray-200`}>
          <p role="status">{saveMessage}</p>
          {onDownloadDraft && <button type="button" className="shrink-0 underline" onClick={onDownloadDraft}>Download draft</button>}
        </DismissibleNotice>
      )}
      {translationNotice && (
        <DismissibleNotice key={translationNotice} closeLabel="Close translation notification" onDismiss={onDismissTranslation} className={warningClass}>
          <p role="status">{translationNotice}</p>
        </DismissibleNotice>
      )}
      {lowCreditOffer && (
        <DismissibleNotice key={`${lowCreditOffer.credits}-${lowCreditOffer.price}`} closeLabel="Close low credit notification" className={neutralClass}>
          <p className="text-sm font-medium text-white">
            Low credits? Add {lowCreditOffer.credits} credits for {lowCreditOffer.price} - no plan change needed.
          </p>
          <button type="button" onClick={onTopUp} className={actionButtonClass}>
            Top Up
          </button>
        </DismissibleNotice>
      )}
      {showCaptionRetry && (
        <DismissibleNotice closeLabel="Close caption retry notification" className={`${noticeClass} flex-wrap border border-amber-400/25 bg-[#1a1608]/95`}>
          <p className="text-sm text-amber-50">
            Captions were not generated. Your video is saved — retry without uploading it again.
          </p>
          <button type="button" onClick={onRetryCaptions} disabled={retryDisabled} className={actionButtonClass}>
            Retry captions
          </button>
        </DismissibleNotice>
      )}
    </div>
  )
}
