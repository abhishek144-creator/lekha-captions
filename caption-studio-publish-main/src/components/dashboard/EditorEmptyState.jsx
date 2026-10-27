import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadDraft } from '@/lib/localDraftStorage'
import DismissibleNotice from './DismissibleNotice'

// The "Start Creating Captions" screen. A same-browser recovery copy
// stays available alongside the account draft. Switching to the account copy
// explicitly downloads the browser edits first, rather than hiding newer work.
export default function EditorEmptyState({
  localRecoveryDraft,
  applyLocalDraft,
  accountDraft,
  onContinueAccountDraft,
  handleUploadModalOpen,
}) {
  const [recoveryError, setRecoveryError] = useState('')
  const openAccountDraft = () => {
    setRecoveryError('')
    try {
      if (localRecoveryDraft) downloadDraft(localRecoveryDraft)
      onContinueAccountDraft()
    } catch {
      setRecoveryError('Could not download the browser backup. Your draft has not been replaced. Please try the backup again.')
    }
  }

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
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => applyLocalDraft(localRecoveryDraft)}>Continue saved draft</Button>
              <Button variant="outline" className="border-white/20 bg-white text-black hover:bg-gray-100 hover:text-black" onClick={() => downloadDraft(localRecoveryDraft)}>Download draft backup</Button>
            </div>
          </div>
        )}
        {accountDraft && (
          <div className="mb-4 rounded border border-white/15 p-3 text-left">
            <p className="mb-2 text-sm text-gray-300">
              Account draft: {accountDraft.projectName || accountDraft.originalFileName || 'Saved project'}
              {' · '}{accountDraft.captions?.length || 0} captions
            </p>
            {localRecoveryDraft && (
              <p className="mb-3 text-xs text-gray-400">
                This browser and your account can have different drafts. Keep the browser copy above, or download its backup and open the account copy.
              </p>
            )}
            <Button className="h-auto min-h-9 whitespace-normal text-left" onClick={openAccountDraft}>
              {localRecoveryDraft ? 'Back up browser draft & open account draft' : 'Continue account draft'}
            </Button>
            {recoveryError && <p role="alert" className="mt-2 text-sm text-red-300">{recoveryError}</p>}
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
