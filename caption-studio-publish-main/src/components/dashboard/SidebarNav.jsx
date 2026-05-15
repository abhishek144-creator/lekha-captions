import React from 'react';
import { Captions, Clock3, Layers, Layout, Type, Sparkles, Video, Crown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const navItems = [
  { id: 'captions', icon: Captions, label: 'Captions' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'animate', icon: Sparkles, label: 'Animate' },
  { id: 'templates', icon: Layout, label: 'Templates' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'history', icon: Clock3, label: 'History' },
];

export default function SidebarNav({ activeTab, setActiveTab, user, onOpenPricing }) {
  const { currentUser, userData, logout } = useAuth();

  const getPlanDetails = () => {
    const plan = userData?.subscription_tier || 'free'
    if (plan === 'starter' || plan === 'starter_yearly')
      return { name: 'Starter', icon: <Crown className="w-4 h-4" />, totalCredits: 15 }
    if (plan === 'creator' || plan === 'creator_yearly')
      return { name: 'Creator', icon: <Crown className="w-4 h-4" />, totalCredits: 45 }
    if (plan === 'pro' || plan === 'pro_yearly')
      return { name: 'Pro', icon: <Crown className="w-4 h-4" />, totalCredits: 100 }
    return { name: 'Free', icon: <Video className="w-4 h-4" />, totalCredits: 3 }
  }

  const planDetails = getPlanDetails();
  const creditsLeft = userData?.credits_remaining ?? 0;

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('captionEditorState');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="w-12 h-full relative flex flex-col items-center justify-center py-1">
      <div className="w-12 bg-[#0f0f0f] border border-white/5 rounded-full flex flex-col items-center py-3 gap-1 self-center shadow-[0_12px_32px_-18px_rgba(0,0,0,0.9)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.disabled;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              className={`w-9 h-9 flex items-center justify-center transition-colors relative rounded-full ${isActive
                ? 'text-white'
                : isDisabled
                  ? 'text-zinc-700 cursor-not-allowed'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom: Plan/User Info */}
      {currentUser && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="absolute bottom-1 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full border border-white/5 bg-[#0f0f0f] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
              <div className="hidden">
                <p className="text-[9px] text-gray-400 font-medium">{planDetails.name}</p>
                <p className="text-[10px] text-white font-semibold mt-0.5">
                  {creditsLeft} of {planDetails.totalCredits}
                </p>
              </div>
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-[#F5A623]/50"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 flex items-center justify-center text-white text-xs font-bold">
                  {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-52 bg-zinc-900 border-white/10 p-2">
            <div className="space-y-1">
              {currentUser.photoURL && (
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10 mb-1 pb-2">
                  <img src={currentUser.photoURL} alt="" className="w-6 h-6 rounded-full" />
                  <span className="text-xs text-gray-300 truncate">{currentUser.displayName || currentUser.email}</span>
                </div>
              )}
              <Button
                onClick={onOpenPricing}
                className="w-full justify-start bg-white hover:bg-gray-100 text-black font-semibold rounded-[4px]"
                size="sm"
              >
                Upgrade Plan
              </Button>
              <Link to={createPageUrl('UserAccount')} className="block">
                <Button variant="ghost" size="sm" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                  <span className="text-sm">Manage Account</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-gray-400 hover:text-red-400 hover:bg-white/5"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="text-sm">Logout</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {!currentUser && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full border border-white/5 bg-[#0f0f0f] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-zinc-500 text-xs font-medium">?</span>
          </div>
        </div>
      )}
    </div>
  );
}
