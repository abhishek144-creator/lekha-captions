import React from 'react'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadDraft } from '@/lib/localDraftStorage'

// The "Start Creating Captions" screen. A same-browser recovery copy takes
// precedence over the account draft: it can hold edits the account never
// received, and continuing the account draft would overwrite them.
export default function EditorEmptyState({
  localRecoveryDraft,
  applyLocalDraft,
  discardLocalDraft,
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
          <div className="mb-6 rounded border border-yellow-500/30 p-4 text-left" role="status">
            <p className="mb-3 text-sm text-gray-300">Your previous draft is available on this browser.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => applyLocalDraft(localRecoveryDraft)}>Continue saved draft</Button>
              <Button variant="outline" className="border-white/20 bg-white text-black hover:bg-gray-100 hover:text-black" onClick={() => downloadDraft(localRecoveryDraft)}>Download draft backup</Button>
            </div>
          </div>
        )}
        {accountDraft && !localRecoveryDraft && (
          <Button className="mb-4" onClick={onContinueAccountDraft}>
            Continue account draft
          </Button>
        )}
        <Button
          onClick={() => {
            if (localRecoveryDraft) discardLocalDraft()
            handleUploadModalOpen()
          }}
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
