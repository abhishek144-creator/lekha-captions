import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CaptionStudioLogo from './CaptionStudioLogo';
import { isSubscriptionExpired } from '@/lib/subscription';
import {
  Upload,
  Download,
  Save,
  Loader2,
  Undo,
  Redo,
  RotateCw,
  Crown,
  MoreHorizontal,
  Check
} from 'lucide-react';

export default function DashboardHeader({
  onUploadClick,
  onExportClick,
  onSaveClick,
  isSaving,
  saveSuccess,
  hasVideo,
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const runFromMenu = (action) => () => {
    setIsMoreOpen(false);
    action?.();
  };
  // Show Upgrade button for: guest users, free plan users, or expired paid plans
  const showUpgrade = (() => {
    // Guest / not signed in
    if (!user) return true;
    // Signed in but no Firestore data yet — show upgrade by default
    if (!userData) return true;
    // Free plan users
    if (!userData.subscription_tier || userData.subscription_tier === 'free') return true;
    // Paid plan that has expired
    if (isSubscriptionExpired(userData.subscription_expiry)) return true;
    return false;
  })();

  return (
    <header className="h-14 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-4 lg:px-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('Home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        {/* Desktop shows this badge above the preview instead. */}
        <span
          title="Lekha Captions is in public beta — please report anything that looks wrong."
          className="lg:hidden shrink-0 rounded-full border border-[#F5A623]/40 bg-[#F5A623]/10 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[#F5A623]"
        >
          Beta
        </span>
      </div>

      {/* Phone/tablet actions (matches the mobile dock breakpoint): undo/redo and Export stay one tap away; the rest
          lives in the overflow menu. */}
      {hasVideo && (
        <div className="flex lg:hidden items-center gap-1.5">
          {/* Save lives in the overflow menu here, so confirm it inline. */}
          {(isSaving || saveSuccess) && (
            <span role="status" className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="max-[359px]:hidden">{isSaving ? 'Saving…' : 'Saved'}</span>
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-10 w-10 rounded-full text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-25"
            aria-label="Undo"
          >
            <Undo className="w-[18px] h-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-10 w-10 rounded-full text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-25"
            aria-label="Redo"
          >
            <Redo className="w-[18px] h-[18px]" />
          </Button>
          <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-gray-300 hover:text-white hover:bg-white/10"
                aria-label="More actions"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5 bg-[#111] border-white/10 text-white">
              {showUpgrade && (
                <button type="button" onClick={runFromMenu(onUpgradeClick)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#F5A623] active:bg-white/10">
                  <Crown className="w-4 h-4" /> Upgrade
                </button>
              )}
              <button type="button" onClick={runFromMenu(onUploadClick)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm active:bg-white/10">
                <Upload className="w-4 h-4 text-gray-400" /> Upload new video
              </button>
              <button type="button" onClick={runFromMenu(onSaveClick)} disabled={isSaving} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm active:bg-white/10 disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Save className="w-4 h-4 text-gray-400" />}
                {saveSuccess ? 'Saved ✓' : 'Save'}
              </button>
              <button type="button" onClick={runFromMenu(onRefresh)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm active:bg-white/10">
                <RotateCw className="w-4 h-4 text-gray-400" /> Reset to original
              </button>
            </PopoverContent>
          </Popover>
          <Button
            onClick={onExportClick}
            size="sm"
            className="ml-1 h-10 bg-white hover:bg-gray-100 text-black font-bold rounded-full px-4"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className={`${hasVideo ? 'hidden lg:flex' : 'flex'} items-center gap-2 sm:gap-3`}>
        {hasVideo && (
          <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-3">
            {showUpgrade && (
              <Button
                onClick={onUpgradeClick}
                size="sm"
                className="mr-1 h-8 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg px-3 flex items-center gap-1.5 transition-colors"
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
              className="h-8 w-8 rounded-full border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8 rounded-full border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8 rounded-full border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
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
              className="h-8 rounded-lg border border-white/10 bg-white/[0.03] text-gray-200 hover:text-white hover:bg-white/10 font-semibold"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Upload New</span>
            </Button>

            <Button
              onClick={onSaveClick}
              variant="ghost"
              size="sm"
              disabled={isSaving}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.03] text-gray-200 hover:text-white hover:bg-white/10 font-semibold"
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
              className="h-8 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg tracking-[0.18em] uppercase"
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
