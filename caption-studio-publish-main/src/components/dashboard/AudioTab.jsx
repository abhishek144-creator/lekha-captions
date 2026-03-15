import React, { useState } from 'react';
import { AudioLines, Volume2, VolumeX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function AudioTab({ onAudioEnhance }) {
  const [removeNoise, setRemoveNoise] = useState(false);
  const [enhanceQuality, setEnhanceQuality] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    if (!removeNoise && !enhanceQuality) return;
    
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      if (onAudioEnhance) {
        onAudioEnhance({ removeNoise, enhanceQuality });
      }
    }, 2000);
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <h2 className="text-lg font-semibold text-white mb-6">Audio Enhancement</h2>
      
      <div className="space-y-6">
        {/* Remove Background Noise */}
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-purple-400" />
              <Label className="text-sm text-white">Remove Background Noise</Label>
            </div>
            <Switch
              checked={removeNoise}
              onCheckedChange={setRemoveNoise}
            />
          </div>
          <p className="text-xs text-gray-500">
            Eliminates unwanted background sounds and improves voice clarity
          </p>
        </div>

        {/* Enhance Overall Audio Quality */}
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-purple-400" />
              <Label className="text-sm text-white">Enhance Audio Quality</Label>
            </div>
            <Switch
              checked={enhanceQuality}
              onCheckedChange={setEnhanceQuality}
            />
          </div>
          <p className="text-xs text-gray-500">
            Boosts audio levels and improves overall sound quality
          </p>
        </div>

        {/* Apply Button */}
        {(removeNoise || enhanceQuality) && (
          <Button
            onClick={handleApply}
            disabled={isProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? (
              <>
                <AudioLines className="w-4 h-4 mr-2 animate-pulse" />
                Processing Audio...
              </>
            ) : (
              <>
                <AudioLines className="w-4 h-4 mr-2" />
                Apply Enhancements
              </>
            )}
          </Button>
        )}

        {/* Info */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-300">
            💡 Audio enhancements will be applied when you export your video
          </p>
        </div>
      </div>
    </div>
  );
}