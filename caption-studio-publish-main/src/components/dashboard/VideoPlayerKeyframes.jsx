import React from 'react'

// Entrance keyframes referenced by caption, word and text-element animations
// in the editor preview (word-* keep the inner span's translate(-50%,-50%)
// centering; source-word-* are used by authored template markup).
const VIDEO_PLAYER_KEYFRAMES = `
@keyframes rise {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes pan {
  0% { transform: translateX(-30px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes fade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes wipe {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes blur {
  0% { filter: blur(10px); opacity: 0; }
  100% { filter: blur(0); opacity: 1; }
}
@keyframes succession {
  0% { transform: translateY(-10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}
@keyframes baseline {
  0% { transform: translateY(5px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes drift {
  0% { transform: translate(-10px, -10px); opacity: 0; }
  100% { transform: translate(0, 0); opacity: 1; }
}
@keyframes tectonic {
  0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
  100% { transform: translateX(0) rotate(0); opacity: 1; }
}
@keyframes tumble {
  0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
  100% { transform: rotate(0) scale(1); opacity: 1; }
}
/* Word-level keyframes — include translate(-50%,-50%) in every step
   to preserve the inner span's centering transform */
@keyframes word-rise {
  0% { transform: translate(-50%, calc(-50% + 20px)); opacity: 0; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes word-pan {
  0% { transform: translate(calc(-50% - 30px), -50%); opacity: 0; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes word-pop {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.1); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes word-succession {
  0% { transform: translate(-50%, calc(-50% - 10px)); opacity: 0; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes word-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.9; }
}
@keyframes word-baseline {
  0% { transform: translate(-50%, calc(-50% + 5px)); opacity: 0; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes word-drift {
  0% { transform: translate(calc(-50% - 10px), calc(-50% - 10px)); opacity: 0; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes word-tectonic {
  0% { transform: translate(calc(-50% - 20px), -50%) rotate(-5deg); opacity: 0; }
  100% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
}
@keyframes word-tumble {
  0% { transform: translate(-50%, -50%) rotate(-180deg) scale(0.5); opacity: 0; }
  100% { transform: translate(-50%, -50%) rotate(0) scale(1); opacity: 1; }
}
@keyframes source-word-rise {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes source-word-pan {
  0% { transform: translateX(-30px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes source-word-fade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes source-word-pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes source-word-wipe {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes source-word-blur {
  0% { filter: blur(10px); opacity: 0; }
  100% { filter: blur(0); opacity: 1; }
}
@keyframes source-word-succession {
  0% { transform: translateY(-10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes source-word-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}
@keyframes source-word-baseline {
  0% { transform: translateY(5px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes source-word-drift {
  0% { transform: translate(-10px, -10px); opacity: 0; }
  100% { transform: translate(0, 0); opacity: 1; }
}
@keyframes source-word-tectonic {
  0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
  100% { transform: translateX(0) rotate(0); opacity: 1; }
}
@keyframes source-word-tumble {
  0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
  100% { transform: rotate(0) scale(1); opacity: 1; }
}
/* ── Advanced – Basic ── */
@keyframes zoom_in {
  0% { transform: scale(0.65); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes zoom_out {
  0% { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fade_in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes slide_up {
  0% { transform: translateY(34px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes slide_down {
  0% { transform: translateY(-34px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes slide_left {
  0% { transform: translateX(44px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes slide_right {
  0% { transform: translateX(-44px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes fadeInUp {
  0% { transform: translateY(22px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes fadeInDown {
  0% { transform: translateY(-22px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes slideInRight {
  0% { transform: translateX(40px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes flipInX {
  0% { transform: perspective(500px) rotateX(-90deg); opacity: 0; }
  100% { transform: perspective(500px) rotateX(0); opacity: 1; }
}
@keyframes flipInY {
  0% { transform: perspective(500px) rotateY(-90deg); opacity: 0; }
  100% { transform: perspective(500px) rotateY(0); opacity: 1; }
}
@keyframes blurIn {
  0% { filter: blur(14px); opacity: 0; }
  100% { filter: blur(0); opacity: 1; }
}
@keyframes zoomInFade {
  0% { transform: scale(0.65); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes bounceInUp {
  0%   { transform: translateY(32px); opacity: 0; }
  60%  { transform: translateY(-8px); opacity: 1; }
  80%  { transform: translateY(4px); }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes skewLeft {
  0% { transform: translateX(-30px) skewX(20deg); opacity: 0; }
  100% { transform: translateX(0) skewX(0deg); opacity: 1; }
}
/* ── Advanced – Kinetic ── */
@keyframes missile {
  0%   { transform: translateX(-60px) scaleX(0.6); opacity: 0; }
  65%  { transform: translateX(6px) scaleX(1.04); opacity: 1; }
  100% { transform: translateX(0) scaleX(1); opacity: 1; }
}
@keyframes shockwave {
  0%   { transform: scale(1.6); opacity: 0; filter: blur(6px); }
  55%  { transform: scale(0.94); opacity: 1; filter: blur(0); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes typewriter {
  0%   { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0% 0 0); }
}
@keyframes slamDown {
  0%   { transform: translateY(-55px) scaleY(1.2); opacity: 0; }
  65%  { transform: translateY(6px) scaleY(0.94); opacity: 1; }
  100% { transform: translateY(0) scaleY(1); opacity: 1; }
}
@keyframes fireCharge {
  0%   { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); }
  70%  { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); }
  100% { transform: translateY(0) scaleX(1); opacity: 1; }
}
@keyframes stampede {
  0%   { transform: translateX(-55px) scaleX(1.1); opacity: 0; }
  70%  { transform: translateX(5px) scaleX(0.98); opacity: 1; }
  100% { transform: translateX(0) scaleX(1); opacity: 1; }
}
@keyframes recoil {
  0%   { transform: translateX(0); opacity: 1; }
  20%  { transform: translateX(-10px); }
  60%  { transform: translateX(4px); }
  100% { transform: translateX(0); opacity: 1; }
}
/* ── Advanced – Cinematic ── */
@keyframes irisOpen {
  0%   { clip-path: circle(0% at 50% 50%); opacity: 0.4; }
  100% { clip-path: circle(150% at 50% 50%); opacity: 1; }
}
@keyframes parallaxRise {
  0%   { transform: translateY(14px) scale(0.97); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes goldenRatio {
  0%   { transform: scaleX(0.618) translateX(-20px); opacity: 0; }
  100% { transform: scaleX(1) translateX(0); opacity: 1; }
}
@keyframes curtainSplit {
  0%   { clip-path: inset(0 50% 0 50%); opacity: 0.5; }
  100% { clip-path: inset(0 0% 0 0%); opacity: 1; }
}
@keyframes prestige {
  0%   { transform: scale(1.1); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fadeThroughBlack {
  0%   { opacity: 1; }
  35%  { opacity: 0; }
  65%  { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes depthPull {
  0%   { transform: scale(0.35); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes slowBurn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes diagonalWipe {
  0%   { clip-path: inset(0 100% 100% 0); }
  100% { clip-path: inset(0 0% 0% 0); }
}
/* ── Advanced – Playful ── */
@keyframes confettiPop {
  0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
  55%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
  75%  { transform: scale(0.95) rotate(-1deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes stickerSlap {
  0%   { transform: scale(1.45) rotate(-6deg); opacity: 0; }
  45%  { transform: scale(0.94) rotate(1deg); opacity: 1; }
  75%  { transform: scale(1.02) rotate(0); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes wobbleEntry {
  0%   { transform: translateX(-22px) rotate(-4deg); opacity: 0; }
  35%  { transform: translateX(9px) rotate(2deg); opacity: 1; }
  65%  { transform: translateX(-4px) rotate(-1deg); }
  100% { transform: translateX(0) rotate(0); opacity: 1; }
}
@keyframes balloonFloat {
  0%   { transform: translateY(22px) scale(0.8); opacity: 0; }
  65%  { transform: translateY(-6px) scale(1.03); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes colorSplash {
  0%   { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); }
  50%  { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); }
  100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); }
}
`

export default function VideoPlayerKeyframes() {
  return <style>{VIDEO_PLAYER_KEYFRAMES}</style>
}
