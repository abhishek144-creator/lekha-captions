import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

/*
  TEMPLATES 2 — 15 world-class premium templates.
  Each uses carefully chosen fonts, unique animations, and curated color palettes.
  CSS lives in captionTemplates.css (class prefix: t-p1 through t-p15).
*/
const templates = [
    {
        id: 't-p1', name: 'Neon City',
        desc: 'Cyberpunk electric neon with pulsing glow',
        preview: 'NEON CITY',
        font: 'Orbitron',
        category: 'Futuristic',
        style: { template_id: 't-p1', font_family: 'Orbitron', font_size: 22, font_weight: '700', text_case: 'uppercase', position_y: 75 }
    },
    {
        id: 't-p2', name: 'Luxury Gold',
        desc: 'Elegant golden serif with shimmer fade',
        preview: 'Golden Hour',
        font: 'Cormorant Garamond',
        category: 'Elegant',
        style: { template_id: 't-p2', font_family: 'Cormorant Garamond', font_size: 28, font_weight: '600', font_style: 'italic', position_y: 75 }
    },
    {
        id: 't-p3', name: 'Street Graffiti',
        desc: 'Raw spray paint chaos with 3D depth',
        preview: 'SPRAY IT',
        font: 'Permanent Marker',
        category: 'Urban',
        style: { template_id: 't-p3', font_family: 'Permanent Marker', font_size: 30, position_y: 70 }
    },
    {
        id: 't-p4', name: 'Retro Pixel',
        desc: '8-bit arcade style with pixel drop',
        preview: 'GAME ON',
        font: 'Press Start 2P',
        category: 'Retro',
        style: { template_id: 't-p4', font_family: 'Press Start 2P', font_size: 14, position_y: 80 }
    },
    {
        id: 't-p5', name: 'Minimal Zen',
        desc: 'Ultra-clean soft fade, featherlight',
        preview: 'breathe in',
        font: 'Quicksand',
        category: 'Minimal',
        style: { template_id: 't-p5', font_family: 'Quicksand', font_size: 22, font_weight: '300', position_y: 75 }
    },
    {
        id: 't-p6', name: 'Comic Pop',
        desc: 'Bold comic book impact with slam entry',
        preview: 'POW!',
        font: 'Comic Neue',
        category: 'Fun',
        style: { template_id: 't-p6', font_family: 'Comic Neue', font_size: 30, font_weight: '700', text_case: 'uppercase', position_y: 70 }
    },
    {
        id: 't-p7', name: 'Typewriter',
        desc: 'Classic mono teleprinter on dark paper',
        preview: 'click click',
        font: 'Courier Prime',
        category: 'Classic',
        style: { template_id: 't-p7', font_family: 'Courier Prime', font_size: 22, position_y: 75 }
    },
    {
        id: 't-p8', name: 'Sunset Blaze',
        desc: 'Warm orange rising with purple haze',
        preview: 'Golden Vibes',
        font: 'Righteous',
        category: 'Warm',
        style: { template_id: 't-p8', font_family: 'Righteous', font_size: 28, position_y: 75 }
    },
    {
        id: 't-p9', name: 'Ice Crystal',
        desc: 'Frost-blue shatter with crystalline glow',
        preview: 'FROZEN',
        font: 'Rajdhani',
        category: 'Cool',
        style: { template_id: 't-p9', font_family: 'Rajdhani', font_size: 26, font_weight: '700', text_case: 'uppercase', position_y: 75 }
    },
    {
        id: 't-p10', name: 'Dark Academia',
        desc: 'Scholarly vintage serif with book reveal',
        preview: 'wisdom speaks',
        font: 'EB Garamond',
        category: 'Elegant',
        style: { template_id: 't-p10', font_family: 'EB Garamond', font_size: 26, font_weight: '500', font_style: 'italic', position_y: 75 }
    },
    {
        id: 't-p11', name: 'K-Pop Burst',
        desc: 'Bold Korean-pop pastels with bounce',
        preview: 'POP STAR',
        font: 'Black Han Sans',
        category: 'Bold',
        style: { template_id: 't-p11', font_family: 'Black Han Sans', font_size: 32, text_case: 'uppercase', position_y: 70 }
    },
    {
        id: 't-p12', name: 'Smoke & Mirrors',
        desc: 'Cinematic smoke dissolve from blur',
        preview: 'Vanishing',
        font: 'Abril Fatface',
        category: 'Cinematic',
        style: { template_id: 't-p12', font_family: 'Abril Fatface', font_size: 30, position_y: 75 }
    },
    {
        id: 't-p13', name: 'Glitch Matrix',
        desc: 'Digital code rain with RGB split',
        preview: 'SYSTEM ONLINE',
        font: 'Share Tech Mono',
        category: 'Futuristic',
        style: { template_id: 't-p13', font_family: 'Share Tech Mono', font_size: 20, text_case: 'uppercase', position_y: 80 }
    },
    {
        id: 't-p14', name: 'Royal Purple',
        desc: 'Regal serif with gold accents on purple',
        preview: 'MAJESTY',
        font: 'Cinzel',
        category: 'Elegant',
        style: { template_id: 't-p14', font_family: 'Cinzel', font_size: 24, font_weight: '700', text_case: 'uppercase', position_y: 75 }
    },
    {
        id: 't-p15', name: 'Candy Pop',
        desc: 'Rounded candy colors with bouncy entry',
        preview: 'Sweet!',
        font: 'Fredoka',
        category: 'Fun',
        style: { template_id: 't-p15', font_family: 'Fredoka', font_size: 28, font_weight: '600', position_y: 75 }
    },
];

// Category color accents
const categoryColors = {
    Futuristic: '#00FFFF',
    Elegant: '#D4AF37',
    Urban: '#FF3366',
    Retro: '#00FF00',
    Minimal: '#ffffff',
    Fun: '#FF6FCF',
    Classic: '#E8D5B0',
    Warm: '#FF6B35',
    Cool: '#B8E8FC',
    Bold: '#FF69B4',
    Cinematic: '#E8C8FF',
};

// Preview visual config per template
const getPreviewColors = (id) => {
    const map = {
        't-p1': { bg: '#0a0a1a', text: '#00FFFF', shadow: '0 0 10px #00FFFF,0 0 30px #0088FF' },
        't-p2': { bg: '#1a1510', text: '#D4AF37', shadow: '0 1px 4px rgba(212,175,55,.5)' },
        't-p3': { bg: '#1a1a1a', text: '#FF3366', shadow: '3px 3px 0 #000,5px 5px 0 rgba(255,51,102,.3)' },
        't-p4': { bg: '#001100', text: '#00FF00', shadow: '2px 2px 0 #005500' },
        't-p5': { bg: '#111', text: 'rgba(255,255,255,.9)', shadow: 'none' },
        't-p6': { bg: '#1a1a1a', text: '#FFE600', shadow: '4px 4px 0 #FF0000' },
        't-p7': { bg: '#1a1812', text: '#E8D5B0', shadow: '0 0 1px rgba(232,213,176,.4)' },
        't-p8': { bg: '#1a0e08', text: '#FF6B35', shadow: '0 0 15px rgba(255,107,53,.7)' },
        't-p9': { bg: '#0a1520', text: '#B8E8FC', shadow: '0 0 12px rgba(184,232,252,.8)' },
        't-p10': { bg: '#1a1510', text: '#C9A96E', shadow: '0 2px 6px rgba(0,0,0,.6)' },
        't-p11': { bg: '#1a0a1a', text: '#FF69B4', shadow: '3px 3px 0 #7B2FF7' },
        't-p12': { bg: '#111', text: 'rgba(255,255,255,.9)', shadow: '0 4px 15px rgba(0,0,0,.5)' },
        't-p13': { bg: '#0a0a0a', text: '#00FF41', shadow: '0 0 8px #00FF41,2px 0 0 #FF0040,-2px 0 0 #0040FF' },
        't-p14': { bg: '#15101e', text: '#E8D5FF', shadow: '0 0 12px rgba(147,112,219,.6)' },
        't-p15': { bg: '#1a0a1a', text: '#FF6FCF', shadow: '3px 3px 0 #7B2FF7' },
    };
    return map[id] || { bg: '#1a1a1a', text: '#fff', shadow: 'none' };
};

export default function TemplatesTab2({ currentStyle, onApplyTemplate }) {
    if (!currentStyle || !onApplyTemplate) return null;

    const handleClearTemplate = () => {
        onApplyTemplate({
            template_id: '',
            font_family: 'Inter',
            font_size: 18,
            font_weight: '500',
            font_style: 'normal',
            text_color: '#ffffff',
            text_case: '',
            position_y: 75,
        });
    };

    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Premium Templates</h2>
                </div>
                <p className="text-xs text-gray-500">15 world-class caption designs with premium fonts & animations</p>
            </div>

            {/* Clear template button */}
            {currentStyle?.template_id && (
                <button
                    onClick={handleClearTemplate}
                    className="w-full mb-3 p-2 rounded-lg bg-zinc-800 border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
                >
                    ✕ Clear Template — Back to Default
                </button>
            )}

            <div className="space-y-3">
                {templates.map((template, index) => {
                    const isActive = currentStyle?.template_id === template.id;
                    const colors = getPreviewColors(template.id);
                    const catColor = categoryColors[template.category] || '#888';

                    return (
                        <motion.div
                            key={template.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.25 }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${isActive
                                ? 'border-white/60 bg-white/10 shadow-[0_0_16px_rgba(255,255,255,0.08)]'
                                : 'border-white/8 bg-white/[0.02] hover:border-white/15'
                                }`}
                            onClick={() => onApplyTemplate(template.style)}
                        >
                            {/* Preview strip with dark cinematic feel */}
                            <div
                                className="px-4 py-4 flex items-center justify-center relative overflow-hidden"
                                style={{ backgroundColor: colors.bg }}
                            >
                                {/* Subtle grain overlay */}
                                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

                                <span
                                    style={{
                                        fontFamily: template.font,
                                        fontSize: template.style.font_size > 24 ? '18px' : '15px',
                                        fontWeight: template.style.font_weight || 'normal',
                                        fontStyle: template.style.font_style || 'normal',
                                        textTransform: template.style.text_case || 'none',
                                        color: colors.text,
                                        textShadow: colors.shadow,
                                        letterSpacing: '0.03em',
                                        position: 'relative',
                                        zIndex: 1,
                                    }}
                                >
                                    {template.preview}
                                </span>
                            </div>

                            {/* Info row */}
                            <div className="px-3 py-2 flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm text-white font-medium flex items-center gap-1.5">
                                        {template.name}
                                        {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span
                                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                                            style={{
                                                color: catColor,
                                                backgroundColor: `${catColor}15`,
                                                border: `1px solid ${catColor}30`,
                                            }}
                                        >
                                            {template.category}
                                        </span>
                                        <span className="text-[9px] text-gray-600 truncate">{template.font}</span>
                                    </div>
                                </div>
                                {!isActive && (
                                    <Button
                                        size="sm"
                                        className="h-7 text-[10px] bg-white/10 hover:bg-white/20 text-white border border-white/20 ml-2 flex-shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onApplyTemplate(template.style);
                                        }}
                                    >
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Apply
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
