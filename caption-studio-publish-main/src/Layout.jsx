import React from 'react';

export default function Layout({ children, currentPageName }) {
  // No layout wrapper needed - pages handle their own layout
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&family=Oswald:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=PT+Sans:wght@400;700&family=Merriweather:wght@300;400;700&family=Nunito:wght@300;400;600;700&family=Playfair+Display:wght@400;500;600;700&family=Ubuntu:wght@300;400;500;700&family=Bebas+Neue&family=Mukta:wght@300;400;600;700&family=Rubik:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;500;600;700&family=Barlow:wght@300;400;500;600;700&family=Quicksand:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Lexend:wght@300;400;500;600;700&family=Archivo:wght@300;400;500;600;700&family=Sora:wght@300;400;500;600;700&family=Epilogue:wght@300;400;500;600;700&family=Red+Hat+Display:wght@300;400;500;600;700&family=Figtree:wght@300;400;500;600;700&family=Urbanist:wght@300;400;500;600;700&family=Exo+2:wght@300;400;500;600;700&family=Karla:wght@300;400;500;600;700&family=Cabin:wght@400;500;600;700&family=Bitter:wght@300;400;500;700&family=Crimson+Text:wght@400;600;700&family=Titillium+Web:wght@300;400;600;700&family=Varela+Round&family=Josefin+Sans:wght@300;400;500;600;700&family=Oxygen:wght@300;400;700&family=Arimo:wght@400;500;600;700&family=Dosis:wght@300;400;500;600;700&family=Anton&family=Fjalla+One&family=Righteous&family=Permanent+Marker&family=Pacifico&family=Lobster&family=Dancing+Script:wght@400;500;600;700&family=Indie+Flower&family=Satisfy&family=Alfa+Slab+One&family=Architects+Daughter&family=Shadows+Into+Light&family=Patua+One&family=Russo+One&family=Bangers&family=Bungee&family=Fredoka+One&family=Passion+One&family=Staatliches&family=Yellowtail&family=Amatic+SC:wght@400;700&family=Caveat:wght@400;500;600;700&family=Kalam:wght@300;400;700&family=Concert+One&family=Saira:wght@300;400;500;600;700&family=Teko:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600;700&family=Sawarabi+Gothic&display=swap');
        
        /* OLD BRAND (preserved for revert)
        :root {
          --brand-primary: #9333ea;
          --brand-accent: #2563eb;
          --brand-bg: #0a0a0a;
          --brand-cta: #9333ea;
          --brand-text: #ffffff;
          --brand-surface: rgba(255,255,255,0.05);
          --brand-secondary-text: #9ca3af;
        }
        */
        :root {
          --brand-primary: #0A0A0A;
          --brand-accent: #F5A623;
          --brand-warm: #F5A623;
          --brand-bg: #F8F6F1;
          --brand-dark: #1A1A2E;
          --brand-surface: #E8F5F0;
          --brand-cta: #F5A623;
          --brand-cta-text: #000000;
          --brand-text: #1A1A2E;
          --brand-text-secondary: #6C7A89;
          --brand-error: #E74C3C;
          --brand-neutral: #6C7A89;
        }

        body {
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
        }

        body {
          background-color: #0a0a0a;
          margin: 0;
          padding: 0;
        }
        
        /* Custom scrollbar for the whole app */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        
        /* Slider track color override */
        [data-orientation="horizontal"][role="slider"] {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
      {children}
    </>
  );
}