import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Zap, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Standard animations
const wordAnimations = [
  { value: 'none', label: 'None' },
  { value: 'rise', label: 'Rise' },
  { value: 'pan', label: 'Pan' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'blur', label: 'Blur' },
  { value: 'succession', label: 'Succession' },
  { value: 'breathe', label: 'Breathe' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'drift', label: 'Drift' },
  { value: 'tectonic', label: 'Tectonic' },
  { value: 'tumble', label: 'Tumble' },
];

// Advanced animations — grouped by category
const advancedAnimationCategories = {
  Basic: [
    { value: 'zoom_in',     label: 'Zoom In' },
    { value: 'zoom_out',    label: 'Zoom Out' },
    { value: 'fade_in',     label: 'Fade In' },
    { value: 'slide_up',    label: 'Slide Up' },
    { value: 'slide_down',  label: 'Slide Down' },
    { value: 'slide_left',  label: 'Slide Left' },
    { value: 'slide_right', label: 'Slide Right' },
    { value: 'fadeInUp',    label: 'Fade Up' },
    { value: 'fadeInDown',  label: 'Fade Down' },
    { value: 'slideInRight',label: 'Slide Right+' },
    { value: 'flipInX',     label: 'Flip X' },
    { value: 'flipInY',     label: 'Flip Y' },
    { value: 'blurIn',      label: 'Blur In' },
    { value: 'zoomInFade',  label: 'Zoom Fade' },
    { value: 'bounceInUp',  label: 'Bounce Up' },
    { value: 'skewLeft',    label: 'Skew Left' },
  ],
  Kinetic: [
    { value: 'missile', label: 'Missile' },
    { value: 'shockwave', label: 'Shockwave' },
    { value: 'typewriter', label: 'Typewriter' },
    { value: 'slamDown', label: 'Slam Down' },
    { value: 'fireCharge', label: 'Fire Charge' },
    { value: 'stampede', label: 'Stampede' },
    { value: 'recoil', label: 'Recoil' },
  ],
  Cinematic: [
    { value: 'irisOpen', label: 'Iris Open' },
    { value: 'parallaxRise', label: 'Parallax Rise' },
    { value: 'goldenRatio', label: 'Golden Ratio' },
    { value: 'curtainSplit', label: 'Curtain Split' },
    { value: 'prestige', label: 'Prestige' },
    { value: 'fadeThroughBlack', label: 'Through Black' },
    { value: 'depthPull', label: 'Depth Pull' },
    { value: 'slowBurn', label: 'Slow Burn' },
    { value: 'diagonalWipe', label: 'Diagonal Wipe' },
  ],
  Playful: [
    { value: 'confettiPop', label: 'Confetti Pop' },
    { value: 'stickerSlap', label: 'Sticker Slap' },
    { value: 'wobbleEntry', label: 'Wobble In' },
    { value: 'balloonFloat', label: 'Balloon Float' },
    { value: 'colorSplash', label: 'Color Splash' },
  ],
};

// Category accent colors for pills
const categoryColors = {
  Basic: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' },
  Kinetic: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
  Cinematic: { bg: 'bg-white/10', border: 'border-white/20', text: 'text-white/80' },
  Playful: { bg: 'bg-pink-500/15', border: 'border-pink-500/30', text: 'text-pink-400' },
};

// Get all advanced animation values as flat array for quick check
const allAdvancedValues = Object.values(advancedAnimationCategories).flat().map(a => a.value);

export default function AnimateTab({ selectedCaption, captions, setCaptions }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const freshSelectedCaption = captions?.find(c => c.id === selectedCaption?.id) || selectedCaption;
  const currentAnimation = freshSelectedCaption?.animation || 'none';
  const currentSpeed = freshSelectedCaption?.animationSpeed ?? 1;

  const handleAnimationSelect = (animValue) => {
    if (freshSelectedCaption && setCaptions) {
      setCaptions(prev => prev.map(cap => {
        if (cap.id === freshSelectedCaption.id) {
          return { ...cap, animation: animValue };
        }
        return cap;
      }));
    }
  };

  const handleSpeedChange = (speed) => {
    if (freshSelectedCaption && setCaptions) {
      setCaptions(prev => prev.map(cap => {
        if (cap.id === freshSelectedCaption.id) {
          return { ...cap, animationSpeed: speed };
        }
        return cap;
      }));
    }
  };

  const isAdvancedActive = allAdvancedValues.includes(currentAnimation);

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <h2 className="text-lg font-semibold text-white mb-6">Animate Line</h2>

      <div className="space-y-4">
        {!freshSelectedCaption ? (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-gray-300">
              Select a caption or text element to apply animation.
            </p>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">
                {freshSelectedCaption.isTextElement ? 'Selected Text Element' : 'Selected Caption'}
              </p>
              <p className="text-sm text-white font-medium line-clamp-2">"{freshSelectedCaption.text}"</p>
            </div>

            {/* ── GENERAL Animations ── */}
            <div>
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">General</p>
              <div className="grid grid-cols-3 gap-2">
                {wordAnimations.map(anim => (
                  <button
                    key={anim.value}
                    onClick={() => handleAnimationSelect(anim.value)}
                    className={`
                      relative group overflow-hidden rounded-xl p-3 transition-all duration-300 border
                      ${currentAnimation === anim.value && !isAdvancedActive
                        ? 'bg-white/10 border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.08)]'
                        : 'bg-zinc-900/50 border-white/5 hover:border-white/20 hover:bg-zinc-800/80'}
                    `}
                  >
                    <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex flex-col items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-md transition-all duration-300
                        ${currentAnimation === anim.value && !isAdvancedActive
                          ? 'bg-white/20 shadow-lg shadow-white/10 scale-110'
                          : 'bg-white/5 group-hover:bg-white/10 group-hover:scale-105'}
                      `}>
                        <div className={`w-3 h-3 rounded-full bg-white/90 ${anim.value !== 'none' ? 'animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'opacity-50'}`} />
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wider uppercase transition-colors duration-300 ${currentAnimation === anim.value && !isAdvancedActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                        {anim.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── ADVANCED Animations (collapsible) ── */}
            <div className="border-t border-white/5 pt-3">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors mb-2 group"
              >
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-5 h-5 rounded border transition-all ${showAdvanced ? 'bg-white/20 border-white/40' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                    {showAdvanced ? <span className="text-white text-xs font-bold leading-none">−</span> : <Plus className="w-3 h-3 text-gray-400 group-hover:text-white" />}
                  </div>
                  <span className="uppercase tracking-wider font-medium">Advanced Animations</span>
                  {isAdvancedActive && (
                    <span className="text-[9px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full font-semibold">Active</span>
                  )}
                </div>
                <span className="text-gray-600">44 animations</span>
              </button>

              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    key="advanced"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-2">
                      {Object.entries(advancedAnimationCategories).map(([category, anims]) => {
                        const colors = categoryColors[category];
                        return (
                          <div key={category}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${colors.text}`}>{category}</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {anims.map(anim => (
                                <button
                                  key={anim.value}
                                  onClick={() => handleAnimationSelect(anim.value)}
                                  className={`
                                    relative rounded-lg px-2 py-2.5 text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 border
                                    ${currentAnimation === anim.value
                                      ? `${colors.bg} ${colors.border} ${colors.text} shadow-md`
                                      : 'bg-zinc-900/50 border-white/5 text-gray-500 hover:border-white/15 hover:text-gray-300 hover:bg-zinc-800/60'}
                                  `}
                                >
                                  {anim.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Speed Slider */}
            {currentAnimation !== 'none' && (
              <div className="pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Animation Speed</span>
                  <span className="ml-auto text-xs font-semibold text-white">
                    {currentSpeed === 1 ? 'Normal' : currentSpeed < 1 ? 'Slow' : currentSpeed < 2 ? 'Fast' : 'Fastest'}
                    {' '}({currentSpeed}x)
                  </span>
                </div>
                <Slider
                  value={[currentSpeed]}
                  onValueChange={([val]) => handleSpeedChange(val)}
                  min={0.25}
                  max={3}
                  step={0.25}
                  className="cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-600">0.25x Slow</span>
                  <span className="text-[10px] text-gray-600">3x Fast</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/8">
          <p className="text-xs text-gray-400 mb-1">How it works</p>
          <p className="text-xs text-white leading-relaxed">
            Select an animation to apply it to the entire caption line.
            <br /><br />
            For single word animation, click on a single word &amp; use the floating word editor to animate specific words.
          </p>
        </div>
      </div>
    </div>
  );
}