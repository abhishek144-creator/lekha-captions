import React from 'react';

export default function CaptionStudioLogo({ size = 'default', showText = true }) {
  const sizes = {
    small: 'w-6 h-6',
    default: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizes = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className="flex items-center gap-2">
      {/* Logo - Professional play button with subtitles */}
      <div className={`${sizes[size]} relative flex items-center justify-center`}>
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5A623" />
              <stop offset="100%" stopColor="#D4891A" />
            </linearGradient>
          </defs>

          {/* Main background circle */}
          <circle cx="20" cy="20" r="19" fill="url(#logoGradient)" />

          {/* Inner circle for depth */}
          <circle cx="20" cy="20" r="17" fill="#0f0f0f" />

          {/* Play button (triangle) */}
          <path
            d="M14 12L28 20L14 28Z"
            fill="white"
            opacity="0.95"
          />

          {/* Subtitle lines below play button */}
          <line
            x1="12" y1="32" x2="28" y2="32"
            stroke="url(#logoGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          <line
            x1="12" y1="36" x2="20" y2="36"
            stroke="url(#logoGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <span className={`${textSizes[size]} font-bold bg-gradient-to-r from-[#F5A623] to-[#D4891A] bg-clip-text text-transparent`}>
          Lekha Captions
        </span>
      )}
    </div>
  );
}