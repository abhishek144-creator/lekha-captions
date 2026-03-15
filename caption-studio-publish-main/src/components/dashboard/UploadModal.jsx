import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Upload, Film, Sparkles, Globe, Palette, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const indianLanguages = [
  { value: 'assamese', label: 'Assamese (অসমীয়া)' },
  { value: 'bengali', label: 'Bengali (বাংলা)' },
  { value: 'bodo', label: 'Bodo (बड़ो)' },
  { value: 'dogri', label: 'Dogri (डोगरी)' },
  { value: 'english_india', label: 'English (India)' },
  { value: 'gujarati', label: 'Gujarati (ગુજરાતી)' },
  { value: 'hindi', label: 'Hindi (हिंदी)' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'kashmiri', label: 'Kashmiri (कॉशुर)' },
  { value: 'konkani', label: 'Konkani (कोंकणी)' },
  { value: 'maithili', label: 'Maithili (मैथिली)' },
  { value: 'malayalam', label: 'Malayalam (മലയാളം)' },
  { value: 'manipuri', label: 'Manipuri (মৈতৈলোন্)' },
  { value: 'marathi', label: 'Marathi (मराठी)' },
  { value: 'nepali', label: 'Nepali (नेपाली)' },
  { value: 'odia', label: 'Odia (ଓଡ଼ିଆ)' },
  { value: 'punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'santali', label: 'Santali (ᱥᱟᱱᱛᱟᱲᱤ)' },
  { value: 'sindhi', label: 'Sindhi (سنڌي)' },
  { value: 'sinhala', label: 'Sinhala (සිංහල)' },
  { value: 'tamil', label: 'Tamil (தமிழ்)' },
  { value: 'telugu', label: 'Telugu (తెలుగు)' },
  { value: 'urdu', label: 'Urdu (اردو)' },
];

const internationalLanguages = [
  { value: 'arabic', label: 'Arabic (العربية)' },
  { value: 'bulgarian', label: 'Bulgarian' },
  { value: 'burmese', label: 'Burmese (မြန်မာ)' },
  { value: 'catalan', label: 'Catalan' },
  { value: 'chinese_simplified', label: 'Chinese (Simplified)' },
  { value: 'chinese_traditional', label: 'Chinese (Traditional)' },
  { value: 'chinese_cantonese', label: 'Chinese (Cantonese, Hong Kong)' },
  { value: 'czech', label: 'Czech (Čeština)' },
  { value: 'danish', label: 'Danish' },
  { value: 'danish_denmark', label: 'Danish (Denmark)' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'dutch_belgium', label: 'Dutch (Belgium)' },
  { value: 'dzongkha', label: 'Dzongkha (རྫོང་ཁ)' },
  { value: 'english', label: 'English' },
  { value: 'english_us', label: 'English (United States)' },
  { value: 'english_uk', label: 'English (United Kingdom)' },
  { value: 'english_australia', label: 'English (Australia)' },
  { value: 'english_new_zealand', label: 'English (New Zealand)' },
  { value: 'estonian', label: 'Estonian' },
  { value: 'finnish', label: 'Finnish (Suomi)' },
  { value: 'french', label: 'French (Français)' },
  { value: 'french_canada', label: 'French (Canada)' },
  { value: 'german', label: 'German (Deutsch)' },
  { value: 'german_switzerland', label: 'German (Switzerland)' },
  { value: 'greek', label: 'Greek (Ελληνικά)' },
  { value: 'hebrew', label: 'Hebrew (עברית)' },
  { value: 'hungarian', label: 'Hungarian (Magyar)' },
  { value: 'indonesian', label: 'Indonesian (Bahasa)' },
  { value: 'italian', label: 'Italian (Italiano)' },
  { value: 'japanese', label: 'Japanese (日本語)' },
  { value: 'korean', label: 'Korean (한국어)' },
  { value: 'korean_south_korea', label: 'Korean (South Korea)' },
  { value: 'latvian', label: 'Latvian' },
  { value: 'lithuanian', label: 'Lithuanian' },
  { value: 'malay', label: 'Malay (Bahasa Melayu)' },
  { value: 'mandarin', label: 'Mandarin (普通话)' },
  { value: 'norwegian', label: 'Norwegian (Norsk)' },
  { value: 'persian', label: 'Persian (فارسی)' },
  { value: 'polish', label: 'Polish (Polski)' },
  { value: 'portuguese', label: 'Portuguese (Português)' },
  { value: 'romanian', label: 'Romanian (Română)' },
  { value: 'russian', label: 'Russian (Русский)' },
  { value: 'spanish', label: 'Spanish (Español)' },
  { value: 'swahili', label: 'Swahili (Kiswahili)' },
  { value: 'swedish', label: 'Swedish (Svenska)' },
  { value: 'thai', label: 'Thai (ไทย)' },
  { value: 'tibetan', label: 'Tibetan (བོད་སྐད)' },
  { value: 'turkish', label: 'Turkish (Türkçe)' },
  { value: 'ukrainian', label: 'Ukrainian (Українська)' },
  { value: 'vietnamese', label: 'Vietnamese (Tiếng Việt)' },
];

export default function UploadModal({
  open,
  onClose,
  onUpload,
  isUploading
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [style, setStyle] = useState('single_line');
  const [wordsPerLine, setWordsPerLine] = useState('dynamic');
  const [step, setStep] = useState(1);
  const [fileSizeError, setFileSizeError] = useState(null);
  const [showDynamicInfo, setShowDynamicInfo] = useState(false);

  // Reset modal to step 1 (upload page) whenever it opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setStep(1);
      setLanguage('auto');
      setStyle('single_line');
      setWordsPerLine('dynamic');
      setFileSizeError(null);
    }
  }, [open]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        const maxSize = 100 * 1024 * 1024;
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

        if (file.size > maxSize) {
          setFileSizeError(`File size (${fileSizeMB}MB) exceeds 100MB limit.`);
          return;
        }

        setFileSizeError(null);
        setSelectedFile(file);
        setStep(2);
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const maxSize = 100 * 1024 * 1024;
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      if (file.size > maxSize) {
        setFileSizeError(`File size (${fileSizeMB}MB) exceeds 100MB limit.`);
        return;
      }

      setFileSizeError(null);
      setSelectedFile(file);
      setStep(2);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile, { language, style, wordsPerLine });
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setStep(1);
    setLanguage('auto');
    setStyle('dynamic');
    setWordsPerLine('dynamic');
    setFileSizeError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 1 ? 'Upload Video' : 'Caption Settings'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 hover:border-white/20'
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-purple-400" />
                </div>

                <p className="text-white font-medium mb-1">
                  Drop your video here
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  or click to browse
                </p>

                <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    MP4, MOV, WebM
                  </span>
                  <span>15-90 seconds</span>
                  <span>Max 100MB</span>
                </div>
              </div>

              {fileSizeError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{fileSizeError}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <Film className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-white"
                >
                  Change
                </Button>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Caption Language
                </label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10 max-h-80">
                    <SelectItem value="auto" className="text-white hover:bg-white/10 font-medium">
                      🎯 Same as Video (Auto-Detect)
                    </SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-orange-400 text-xs font-semibold uppercase tracking-wider px-2 mt-2">Indian Languages</SelectLabel>
                      {indianLanguages.map(lang => (
                        <SelectItem
                          key={lang.value}
                          value={lang.value}
                          className="text-white hover:bg-white/10"
                        >
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-purple-400 text-xs font-semibold uppercase tracking-wider px-2 mt-2">International</SelectLabel>
                      {internationalLanguages.map(lang => (
                        <SelectItem
                          key={lang.value}
                          value={lang.value}
                          className="text-white hover:bg-white/10"
                        >
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Max Lines
                </label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10">
                    <SelectItem value="single_line" className="text-white hover:bg-white/10">1 (Single Line)</SelectItem>
                    <SelectItem value="double_line" className="text-white hover:bg-white/10">2 (Double Line)</SelectItem>
                    <SelectItem value="dynamic" className="text-white hover:bg-white/10">1-2 lines (dynamic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    Words Per Line
                  </label>
                  {wordsPerLine === 'dynamic' && (
                    <button
                      onClick={() => setShowDynamicInfo(v => !v)}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      How it works
                    </button>
                  )}
                </div>
                <Select value={wordsPerLine} onValueChange={(v) => { setWordsPerLine(v); setShowDynamicInfo(false); }}>
                  <SelectTrigger className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10">
                    <SelectItem value="1" className="text-white hover:bg-white/10">1 word (Fast-paced)</SelectItem>
                    <SelectItem value="1-2" className="text-white hover:bg-white/10">1-2 words (Punchy)</SelectItem>
                    <SelectItem value="2-3" className="text-white hover:bg-white/10">2-3 words (Standard)</SelectItem>
                    <SelectItem value="3-5" className="text-white hover:bg-white/10">3-5 words (Long)</SelectItem>
                    <SelectItem value="dynamic" className="text-white hover:bg-white/10">
                      Dynamic (Auto) - Recommended
                    </SelectItem>
                  </SelectContent>
                </Select>

                {wordsPerLine === 'dynamic' && showDynamicInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-gray-300 space-y-1.5"
                  >
                    <p className="font-semibold text-purple-300">How Dynamic (Auto) works:</p>
                    <p>Syncs captions to the exact millisecond of each spoken word using audio timestamps.</p>
                    <p>Shows 1-3 words at a time by default for maximum readability.</p>
                    <p>If 4-5 words are spoken quickly as a phrase, it shows the full phrase together.</p>
                    <p>Single punchy words appear alone, perfectly timed to the audio beat.</p>
                  </motion.div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Captions
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
