import React from 'react';
import { Type } from 'lucide-react';

export default function FontTab() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
          <Type className="w-7 h-7 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Font Controls</h3>
        <p className="text-sm text-gray-500">
          Advanced font options coming soon
        </p>
      </div>
    </div>
  );
}