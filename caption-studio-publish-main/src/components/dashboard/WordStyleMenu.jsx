import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scriptFontMap } from './fontUtils';

const fontWeights = [
  { value: '300', label: 'Thin' },
  { value: '300', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

export default function WordStyleMenu({ position, onApply, onClose, detectedScript = 'latin' }) {
  const scriptOptions = scriptFontMap[detectedScript] || scriptFontMap.latin;
  const scriptFonts = scriptOptions.map(f => f.name);
  const [selectedFont, setSelectedFont] = useState(scriptFonts[0] || 'Inter');
  const [selectedWeight, setSelectedWeight] = useState('500');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.word-style-menu')) {
        onClose();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const handleApply = () => {
    onApply({ fontFamily: selectedFont, fontWeight: selectedWeight });
    onClose();
  };

  return (
    <div
      className="word-style-menu absolute z-50 bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '200px'
      }}
    >
      <p className="text-xs text-gray-500 mb-2">Style Selected Word</p>

      <Select value={selectedFont} onValueChange={setSelectedFont}>
        <SelectTrigger className="bg-zinc-800 border-white/10 text-white text-sm mb-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-white/10">
          {scriptFonts.map(font => (
            <SelectItem
              key={font}
              value={font}
              className="text-white hover:bg-white/10 text-sm"
              style={{ fontFamily: font }}
            >
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedWeight} onValueChange={setSelectedWeight}>
        <SelectTrigger className="bg-zinc-800 border-white/10 text-white text-sm mb-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-white/10 max-h-60">
          {fontWeights.map((weight, idx) => (
            <SelectItem
              key={idx}
              value={weight.value}
              className="text-white hover:bg-white/10 text-sm"
              style={{ fontWeight: weight.value }}
            >
              {weight.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        onClick={handleApply}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        Apply
      </Button>
    </div>
  );
}