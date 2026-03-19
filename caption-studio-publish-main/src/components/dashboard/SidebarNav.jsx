import React from 'react';
import { Folder, Layout, Type, Sparkles, Video, Crown, LogOut } from 'lucide-react';
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
  { id: 'captions', icon: Folder, label: 'Captions' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'animate', icon: Sparkles, label: 'Animate' },
  { id: 'templates', icon: Layout, label: 'Templates' },
  { id: 'templates2', icon: Crown, label: 'Template 2' },
];

export default function SidebarNav({ activeTab, setActiveTab, user, onOpenPricing }) {
  const { currentUser, userData, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPlanDetails = () => {
    const plan = userData?.subscription_tier || 'free';
    if (plan === 'weekly_creator') {
      return { name: 'Weekly Creator', icon: <Crown className="w-4 h-4" />, gradient: 'from-purple-500 to-pink-500', totalCredits: 10 };
    } else if (plan === 'monthly_pro') {
      return { name: 'Monthly Pro', icon: <Crown className="w-4 h-4" />, gradient: 'from-blue-500 to-cyan-500', totalCredits: 30 };
    } else {
      return { name: 'Free Plan', icon: <Video className="w-4 h-4" />, gradient: 'from-blue-500 to-cyan-500', totalCredits: 3 };
    }
  };

  const planDetails = getPlanDetails();
  const creditsLeft = userData?.credits_remaining ?? 0;
  const isFreePlan = (userData?.subscription_tier || 'free') === 'free';

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
    <div className="w-[72px] bg-black border-r border-white/5 flex flex-col items-center py-4 gap-1 h-full">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        const isDisabled = item.disabled;

        return (
          <button
            key={item.id}
            onClick={() => !isDisabled && setActiveTab(item.id)}
            disabled={isDisabled}
            className={`w-full flex flex-col items-center justify-center py-3 px-2 transition-colors relative ${isActive
              ? 'text-[#2ECC9A]'
              : isDisabled
                ? 'text-zinc-700 cursor-not-allowed'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#2ECC9A] rounded-r-full" />
            )}
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-1.5 font-medium">{item.label}</span>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Plan/User Info */}
      {currentUser && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full flex flex-col items-center py-2 px-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer gap-2">
              <div className="w-full mx-2 px-2 py-2 rounded-lg bg-white/5 text-center">
                <p className="text-[9px] text-gray-400 font-medium">{planDetails.name}</p>
                <p className="text-[10px] text-white font-semibold mt-0.5">
                  {creditsLeft} of {planDetails.totalCredits}
                </p>
              </div>
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Profile"
                  className="w-9 h-9 rounded-full border-2 border-[#2ECC9A]/50"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1B4D3E] to-[#2ECC9A] flex items-center justify-center text-white text-xs font-bold">
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
                className="w-full justify-start bg-[#2ECC9A] hover:bg-[#27b889] text-[#0A3D2C] font-semibold"
                size="sm"
              >
                Upgrade Plan
              </Button>
              <Link to={createPageUrl('UserAccount')} className="block">
                <Button variant="ghost" size="sm" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                  <span className="text-sm">⚙️ Manage Account</span>
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
        <div className="w-full flex flex-col items-center py-2 px-2">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-zinc-500 text-xs font-medium">?</span>
          </div>
        </div>
      )}
    </div>
  );
}