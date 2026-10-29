import React from 'react'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DismissibleNotice from './DismissibleNotice'

// The "Start Creating Captions" screen. A same-browser recovery copy wins over
// the account draft: the account draft is offered only when this browser has
// no newer copy, so neither can hide the other's edits.
export default function EditorEmptyState({
  localRecoveryDraft,
  applyLocalDraft,
  accountDraft,
  onContinueAccountDraft,
  handleUploadModalOpen,
}) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
          <Upload className="w-8 h-8 text-yellow-400" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Start Creating Captions
        </h2>
        <p className="text-gray-500 mb-6">
          Upload your short-form video (best for 15-180 seconds) and we'll generate professional captions instantly.
        </p>
        {localRecoveryDraft && (
          <div className="mb-6 text-left">
            <DismissibleNotice closeLabel="Close draft recovery notification" className="mb-3 rounded border border-yellow-500/30 p-3 text-sm text-gray-300">
              Your previous draft is available on this browser.
            </DismissibleNotice>
            <Button onClick={() => applyLocalDraft(localRecoveryDraft)}>Continue saved draft</Button>
          </div>
        )}
        {accountDraft && !localRecoveryDraft && (
          <div className="mb-4 rounded border border-white/15 p-3 text-left">
            <p className="mb-2 text-sm text-gray-300">
              Account draft: {accountDraft.projectName || accountDraft.originalFileName || 'Saved project'}
              {' · '}{accountDraft.captions?.length || 0} captions
            </p>
            <Button className="h-auto min-h-9 whitespace-normal text-left" onClick={onContinueAccountDraft}>
              Continue account draft
            </Button>
          </div>
        )}
        {/* The recovery copy is discarded only once a new upload is accepted
            (Dashboard.handleUpload), so cancelling the upload window keeps it. */}
        <Button
          onClick={handleUploadModalOpen}
          size="lg"
          className="bg-white hover:bg-gray-100 text-black font-semibold px-8 rounded-[4px]"
        >
          <Upload className="w-5 h-5 mr-2" aria-hidden="true" />
          Upload Video
        </Button>
      </motion.div>
    </div>
  )
}
