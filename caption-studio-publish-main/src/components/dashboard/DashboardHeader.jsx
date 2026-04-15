import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import CaptionStudioLogo from './CaptionStudioLogo';
import {
  Upload,
  Download,
  Save,
  Loader2,
  Undo,
  Redo,
  RotateCw,
  Crown
} from 'lucide-react';

export default function DashboardHeader({
  onUploadClick,
  onExportClick,
  onSaveClick,
  isSaving,
  saveSuccess,
  hasVideo,
  hasCaptions,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRefresh,
  onUpgradeClick,
  user,
  userData,
  onLogin
}) {
  // Show Upgrade button for: guest users, free plan users, or expired paid plans
  const showUpgrade = (() => {
    // Guest / not signed in
    if (!user) return true;
    // Signed in but no Firestore data yet — show upgrade by default
    if (!userData) return true;
    // Free plan users
    if (!userData.subscription_tier || userData.subscription_tier === 'free') return true;
    // Paid plan that has expired
    if (userData.subscription_expiry && new Date(userData.subscription_expiry) < new Date()) return true;
    return false;
  })();

  return (
    <header className="h-16 bg-zinc-950 border-b border-white/5 flex items-center justify-between px-4 lg:px-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('Home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {hasVideo && (
          <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-3">
            {showUpgrade && (
              <Button
                onClick={onUpgradeClick}
                size="sm"
                className="mr-1 h-8 bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px] px-3 flex items-center gap-1.5 transition-colors"
              >
                <Crown className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline text-[13px]">Upgrade</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Reset to Original"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

          </div>
        )}

        {hasVideo && (
          <>
            <Button
              onClick={onUploadClick}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Upload New</span>
            </Button>

            <Button
              onClick={onSaveClick}
              variant="ghost"
              size="sm"
              disabled={isSaving}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
              ) : (
                <Save className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{saveSuccess ? 'Saved ✓' : 'Save'}</span>
            </Button>

            <Button
              onClick={onExportClick}
              size="sm"
              className="bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px]"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </>
        )}


        {/* Show Signup button only when not signed in and no video */}
        {!user && !hasVideo && (
          <Button
            onClick={onLogin}
            size="sm"
            className="ml-1 bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px] px-4 py-2 shadow-sm transition-colors duration-200 h-10"
          >
            <span className="text-[14px]">Signup</span>
          </Button>
        )}

      </div>
    </header>
  );
}