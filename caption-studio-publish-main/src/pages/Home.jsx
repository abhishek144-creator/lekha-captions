import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import Footer from '@/components/landing/Footer';
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#111111]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 h-14 flex items-center justify-between px-6">
        <Link to={createPageUrl('Home')} className="hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex items-center gap-6">
          <Link to={createPageUrl('Faq')} className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</Link>
          <Link to={createPageUrl('Help')} className="text-sm text-gray-400 hover:text-white transition-colors">Help & Support</Link>
          <Link to={createPageUrl('Terms')} className="text-sm text-gray-400 hover:text-white transition-colors">Terms</Link>
        </div>
      </nav>
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </div>
  );
}