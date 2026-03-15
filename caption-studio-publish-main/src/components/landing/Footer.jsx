import React from 'react';
import { Captions } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="py-12 bg-[#0a0a0a] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Captions className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">Caption Studio</span>
          </div>
          
          <p className="text-gray-500 text-sm">
            Built for Indian Creators 🇮🇳
          </p>
          
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} Caption Studio
          </p>
        </div>
      </div>
    </footer>
  );
}