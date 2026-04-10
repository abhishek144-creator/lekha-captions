import React, { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import '../../styles/captionTemplatesAdvanced.css'

/* ─── Font loader ─────────────────────────────────────────────── */
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Serif:ital@1&family=DM+Serif+Display:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=IBM+Plex+Mono:wght@400;700&family=Darker+Grotesque:wght@900&family=Libre+Baskerville:ital@1&family=Dela+Gothic+One&family=Oswald:wght@300&family=Unbounded:wght@300;900&family=Space+Mono:wght@400;700&family=Bodoni+Moda:ital@1&family=Crimson+Text:ital,wght@0,600;1,600&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Josefin+Sans:wght@300;400&family=Questrial&family=Antonio:wght@400;700&family=Staatliches&family=Cinzel:wght@400;900&family=Righteous&family=Bitter:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Archivo+Black&family=Caveat:wght@400;700&family=Silkscreen&family=Abril+Fatface&family=Tenor+Sans&family=Raleway:wght@200;700&family=Permanent+Marker&family=Overpass+Mono:wght@400;700&family=Syne:wght@700&family=Noto+Sans:wght@400;700&display=swap'

/* ─── Template definitions ────────────────────────────────────── */
const templates = [
  {
    id: 't01', name: 'The Awakening', mood: 'Spiritual', dot: '#ff3d71',
    font: 'Bebas Neue',
    style: { template_id: 't01', font_family: 'Bebas Neue', font_size: 26, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t01-cluster">
        <div class="t01-rtop"><span>chapter one</span></div>
        <div class="t01-hl">RISE</div>
        <div class="t01-rbot"><span>and begin again</span></div>
      </div>`,
      `<div class="plain-s t01"><span class="imp">The moment</span> you decided<br>to wake up changed everything.</div>`,
      `<div class="wbw-rise t01"><span class="w">Your</span> <span class="w">story</span> <span class="w">starts</span> <span class="w imp-bold">now.</span></div>`,
    ]
  },
  {
    id: 't02', name: 'The Confession', mood: 'Intimate', dot: '#a78bfa',
    font: 'Cormorant Garamond',
    style: { template_id: 't02', font_family: 'Cormorant Garamond', font_size: 24, font_weight: '300', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t02-split">
        <div class="t02-split-big">I never told anyone <span class="imp">the truth</span></div>
        <div class="t02-split-sub">until now</div>
      </div>`,
      `<div class="t02-split">
        <div class="t02-split-big">Sometimes <span class="imp">silence</span> says more</div>
        <div class="t02-split-sub">than words ever could</div>
      </div>`,
      `<div class="plain-s t02">There are stories<br>we only whisper<br>in the dark.</div>`,
    ]
  },
  {
    id: 't03', name: 'The Machine', mood: 'Startup', dot: '#00e5ff',
    font: 'Darker Grotesque',
    style: { template_id: 't03', font_family: 'Darker Grotesque', font_size: 22, font_weight: '900', text_case: 'uppercase', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t03-snap">BUILD<span class="imp"> FAST</span> SHIP</div>`,
      `<div class="t03-snap">FAIL<span class="imp"> FORWARD</span></div>`,
      `<div class="wbw-rise t03"><span class="w">Move</span> <span class="w imp-cyan">fast.</span> <span class="w">Break</span> <span class="w">limits.</span></div>`,
    ]
  },
  {
    id: 't04', name: 'The Weight', mood: 'Literary', dot: '#d4af37',
    font: 'Libre Baskerville',
    style: { template_id: 't04', font_family: 'Libre Baskerville', font_size: 20, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t04-karaoke">Some words are too heavy to carry alone.</div>`,
      `<div class="t04-karaoke">We carry the grief of those who came before us.</div>`,
      `<div class="plain-s t04">Literature is<br>the memory<br>of humanity.</div>`,
    ]
  },
  {
    id: 't05', name: 'The Storm', mood: 'Drama', dot: '#ff3d71',
    font: 'Dela Gothic One',
    style: { template_id: 't05', font_family: 'Dela Gothic One', font_size: 24, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t05-cluster">
        <div class="t05-rtop"><span>act two</span></div>
        <div class="t05-hl">BREAK</div>
        <div class="t05-rbot"><span>everything</span></div>
      </div>`,
      `<div class="t05-flip"><div class="t05-flip-inner">The calm before the storm<br>never lasts.</div></div>`,
      `<div class="wbw-rise t05"><span class="w">No</span> <span class="w">storm</span> <span class="w">lasts</span> <span class="w imp-rose">forever.</span></div>`,
    ]
  },
  {
    id: 't06', name: 'The Countdown', mood: 'Motivation', dot: '#00e5ff',
    font: 'Unbounded',
    style: { template_id: 't06', font_family: 'Unbounded', font_size: 18, font_weight: '900', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t06-stack">
        <div class="t06-ln">three</div>
        <div class="t06-ln">two</div>
        <div class="t06-ln">one</div>
      </div>
      <div class="t06-hero">GO<span class="acc"> NOW</span></div>`,
      `<div class="t06-hero">NO<span class="acc"> EXCUSES</span></div>`,
      `<div class="wbw-rise t06"><span class="w">Every</span> <span class="w">second</span> <span class="w imp-cyan">counts.</span></div>`,
    ]
  },
  {
    id: 't07', name: 'The Silence', mood: 'Horror', dot: '#52525b',
    font: 'Space Mono',
    style: { template_id: 't07', font_family: 'Space Mono', font_size: 16, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t07-loadbar">
        <div class="t07-loadbar-text">SOMETHING IS <span class="imp">WRONG</span></div>
        <div class="t07-loadbar-bar"></div>
      </div>`,
      `<div class="t07-flkstyle">The door was open.<br><span class="imp-flk">It wasn't before.</span></div>`,
      `<div class="wbw-rise t07"><span class="w">Don't</span> <span class="w">look</span> <span class="w">behind</span> <span class="w imp-bold">you.</span></div>`,
    ]
  },
  {
    id: 't08', name: 'The Frame', mood: 'Cinematic', dot: '#a78bfa',
    font: 'Bodoni Moda',
    style: { template_id: 't08', font_family: 'Bodoni Moda', font_size: 22, font_weight: '400', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t08-frame">
        <div class="t08-bar"></div>
        <div class="t08-mid">
          <div class="t08-lbl">a film by</div>
          <div class="t08-ttl">The Last <span class="em">Summer</span></div>
          <div class="t08-lbl2">2024</div>
        </div>
        <div class="t08-bar b2"></div>
      </div>`,
      `<div class="wbw-rise t08"><span class="w">Based</span> <span class="w">on</span> <span class="w imp-italic">true</span> <span class="w">events.</span></div>`,
      `<div class="plain-s t08">Some moments<br>deserve to be<br>remembered forever.</div>`,
    ]
  },
  {
    id: 't09', name: 'The Seed', mood: 'Defiance', dot: '#ff3d71',
    font: 'Crimson Text',
    style: { template_id: 't09', font_family: 'Crimson Text', font_size: 22, font_weight: '400', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t09-swipe">They said <span class="hl">it couldn't</span> be done.<br>We did it anyway.</div>`,
      `<div class="t09-swipe">Every <span class="hl">revolution</span> starts<br>with a single voice.</div>`,
      `<div class="wbw-rise t09"><span class="w">Defy</span> <span class="w imp-rose">everything</span> <span class="w">they</span> <span class="w">expect.</span></div>`,
    ]
  },
  {
    id: 't10', name: 'The Gravity', mood: 'Impact', dot: '#39ff14',
    font: 'Unbounded',
    style: { template_id: 't10', font_family: 'Unbounded', font_size: 18, font_weight: '900', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t10-cluster">
        <div class="t10-rtop"><span>unstoppable</span></div>
        <div class="t10-hl">FORCE</div>
        <div class="t10-crack"></div>
        <div class="t10-rbot"><span>meets immovable</span></div>
      </div>`,
      `<div class="t10-lsnap">GROUND<span class="imp"> ZERO</span></div>`,
      `<div class="wbw-rise t10"><span class="w">Feel</span> <span class="w imp-green">the</span> <span class="w">weight</span> <span class="w">of it.</span></div>`,
    ]
  },
  {
    id: 't11', name: 'The Signal', mood: 'Sci-Fi', dot: '#00e5ff',
    font: 'Overpass Mono',
    style: { template_id: 't11', font_family: 'Overpass Mono', font_size: 14, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t11-wipe">SIGNAL <span class="imp">DETECTED</span> // SCANNING</div>`,
      `<div class="t11-blur">COORDINATES <span class="imp">LOCKED</span> :: 47°N 12°E</div>`,
      `<div class="wbw-slide t11"><span class="w">Transmission</span> <span class="w imp-cyan">incoming.</span></div>`,
    ]
  },
  {
    id: 't12', name: 'The Ember', mood: 'Love', dot: '#ff3d71',
    font: 'Lora',
    style: { template_id: 't12', font_family: 'Lora', font_size: 22, font_weight: '400', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t12-split">
        <div class="t12-big">You were the <span class="imp">one</span> I chose</div>
        <div class="t12-sub">every single day</div>
      </div>`,
      `<div class="t12-split">
        <div class="t12-big">Love is not a <span class="imp">feeling</span></div>
        <div class="t12-sub">it's a decision</div>
      </div>`,
      `<div class="plain-s t12">In all the universe,<br>I found you.</div>`,
    ]
  },
  {
    id: 't13', name: 'The Headline', mood: 'Editorial', dot: '#ffffff',
    font: 'Abril Fatface',
    style: { template_id: 't13', font_family: 'Abril Fatface', font_size: 26, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t13-cluster">
        <div class="t13-rtop"><span>breaking</span></div>
        <div class="t13-hl">NEWS</div>
        <div class="t13-rbot"><span>today</span></div>
      </div>`,
      `<div class="t13-snap">EVERYTHING<span class="imp"> CHANGES</span></div>`,
      `<div class="wbw-rise t13"><span class="w">The</span> <span class="w imp-bold">truth</span> <span class="w">is</span> <span class="w">out.</span></div>`,
    ]
  },
  {
    id: 't14', name: 'The Street', mood: 'Raw', dot: '#ff3d71',
    font: 'Permanent Marker',
    style: { template_id: 't14', font_family: 'Permanent Marker', font_size: 22, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t14-drop">REAL <span class="imp">TALK</span></div>`,
      `<div class="t14-drop">NO <span class="imp">FILTER</span></div>`,
      `<div class="wbw-slide t14"><span class="w">From</span> <span class="w">the</span> <span class="w imp-rose">streets.</span></div>`,
    ]
  },
  {
    id: 't15', name: 'The Zen', mood: 'Meditation', dot: '#e4e4e7',
    font: 'Questrial',
    style: { template_id: 't15', font_family: 'Questrial', font_size: 20, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t15-karaoke">Breathe in. Let go. Begin again.</div>`,
      `<div class="t15-karaoke">The present moment is always enough.</div>`,
      `<div class="plain-s t15">Be still.<br>You are already<br>whole.</div>`,
    ]
  },
  {
    id: 't16', name: 'The Furnace', mood: 'Battle', dot: '#ff3d71',
    font: 'Staatliches',
    style: { template_id: 't16', font_family: 'Staatliches', font_size: 28, font_weight: '400', text_case: 'uppercase', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t16-cluster">
        <div class="t16-rtop"><span>enter</span></div>
        <div class="t16-hl">FIRE</div>
        <div class="t16-rbot"><span>emerge stronger</span></div>
      </div>`,
      `<div class="t16-flip t16"><div class="t16-flip-inner">The <span class="imp">warrior</span> was forged<br>in the furnace of struggle.</div></div>`,
      `<div class="wbw-rise t16"><span class="w">Steel</span> <span class="w imp-rose">sharpens</span> <span class="w">steel.</span></div>`,
    ]
  },
  {
    id: 't17', name: 'The Velvet', mood: 'Fashion', dot: '#a78bfa',
    font: 'Cinzel',
    style: { template_id: 't17', font_family: 'Cinzel', font_size: 18, font_weight: '400', text_case: 'uppercase', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t17-snap">ELEGANCE <span class="imp">REFINED</span></div>`,
      `<div class="t17-frame">
        <div class="t17-bar"></div>
        <div class="t17-mid">
          <div class="t17-lbl">collection</div>
          <div class="t17-ttl">Noir <span class="em">Luxe</span></div>
        </div>
        <div class="t17-bar b2"></div>
      </div>`,
      `<div class="wbw-slide t17"><span class="w">Style</span> <span class="w">is</span> <span class="w imp-purple">eternal.</span></div>`,
    ]
  },
  {
    id: 't18', name: 'The Pulse', mood: 'Anime', dot: '#a78bfa',
    font: 'Righteous',
    style: { template_id: 't18', font_family: 'Righteous', font_size: 22, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t18-pop">PLUS <span class="imp">ULTRA</span></div>`,
      `<div class="t18-wipe">The power was inside you <span class="imp">all along</span></div>`,
      `<div class="wbw-rise t18"><span class="w">Level</span> <span class="w imp-purple">up.</span> <span class="w">Always.</span></div>`,
    ]
  },
  {
    id: 't19', name: 'The Ledger', mood: 'Documentary', dot: '#d4af37',
    font: 'Bitter',
    style: { template_id: 't19', font_family: 'Bitter', font_size: 20, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t19-lower">
        <div class="t19-line"></div>
        <div class="t19-title">Dr. Sarah <span class="imp">Chen</span></div>
        <div class="t19-sub">Lead Researcher, 2019–Present</div>
      </div>`,
      `<div class="wbw-rise t19"><span class="w">The</span> <span class="w imp-gold">facts</span> <span class="w">speak</span> <span class="w">for themselves.</span></div>`,
      `<div class="wbw-slide t19"><span class="w">Record.</span> <span class="w">Remember.</span> <span class="w imp-bold">Witness.</span></div>`,
    ]
  },
  {
    id: 't20', name: 'The Ghost', mood: 'Nostalgia', dot: '#71717a',
    font: 'Cormorant Garamond',
    style: { template_id: 't20', font_family: 'Cormorant Garamond', font_size: 24, font_weight: '300', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t20-blur">I still remember how <span class="imp">it felt</span></div>`,
      `<div class="t20-blur">Some memories <span class="imp">never fade</span></div>`,
      `<div class="plain-s t20">The past<br>lives in us<br>forever.</div>`,
    ]
  },
  {
    id: 't21', name: 'The Grid', mood: 'Tech', dot: '#00e5ff',
    font: 'Space Mono',
    style: { template_id: 't21', font_family: 'Space Mono', font_size: 14, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t21-loadbar">
        <div class="t21-loadbar-text">LOADING <span class="imp">FUTURE</span> v2.0</div>
        <div class="t21-loadbar-bar"></div>
      </div>`,
      `<div class="t21-snap">SYSTEM<span class="imp"> ONLINE</span></div>`,
      `<div class="wbw-rise t21"><span class="w">Code</span> <span class="w">is</span> <span class="w imp-cyan">poetry.</span></div>`,
    ]
  },
  {
    id: 't22', name: 'The Verse', mood: 'Poetic', dot: '#c4b5fd',
    font: 'Playfair Display',
    style: { template_id: 't22', font_family: 'Playfair Display', font_size: 22, font_weight: '400', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t22-slideup">And I loved you<br>the way <span class="imp">the sea</span> loves the shore</div>`,
      `<div class="t22-slideup">Words are the only things<br>that <span class="imp">outlive</span> us</div>`,
      `<div class="plain-s t22">Between the lines<br>is where<br>truth hides.</div>`,
    ]
  },
  {
    id: 't23', name: 'The Riot', mood: 'Rebellion', dot: '#ff3d71',
    font: 'Archivo Black',
    style: { template_id: 't23', font_family: 'Archivo Black', font_size: 22, font_weight: '400', text_case: 'uppercase', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t23-drop">BREAK THE <span class="imp">RULES</span></div>`,
      `<div class="t23-swipe">We were told to <span class="hl">stay quiet.</span><br>We refused.</div>`,
      `<div class="wbw-rise t23"><span class="w">Louder.</span> <span class="w">Bolder.</span> <span class="w imp-rose">Freer.</span></div>`,
    ]
  },
  {
    id: 't24', name: 'The Compass', mood: 'Philosophy', dot: '#94a3b8',
    font: 'DM Serif Display',
    style: { template_id: 't24', font_family: 'DM Serif Display', font_size: 22, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t24-split">
        <div class="t24-big">We are not the sum of our<br><span class="imp">mistakes</span></div>
        <div class="t24-sub">but what we do next</div>
      </div>`,
      `<div class="t24-split">
        <div class="t24-big">The examined life is<br>the only <span class="imp">worthy</span> one</div>
        <div class="t24-sub">— Socrates</div>
      </div>`,
      `<div class="wbw-rise t24"><span class="w">Seek</span> <span class="w imp-bold">truth.</span> <span class="w">Always.</span></div>`,
    ]
  },
  {
    id: 't25', name: 'The Wire', mood: 'Thriller', dot: '#39ff14',
    font: 'IBM Plex Mono',
    style: { template_id: 't25', font_family: 'IBM Plex Mono', font_size: 14, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t25-wipe">OPERATION <span class="imp">BLACKOUT</span> :: LIVE</div>`,
      `<div class="t25-flip t25"><div class="t25-flip-inner">They're <span class="imp">watching</span> every move.</div></div>`,
      `<div class="wbw-slide t25"><span class="w">Trust</span> <span class="w imp-green">no one.</span></div>`,
    ]
  },
  {
    id: 't26', name: 'The Crown', mood: 'Hindi', dot: '#d4af37',
    font: 'Bebas Neue',
    style: { template_id: 't26', font_family: 'Bebas Neue', font_size: 26, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t26-cluster">
        <div class="t26-rtop"><span>बहुत दूर</span></div>
        <div class="t26-hl">SAFAR</div>
        <div class="t26-rbot"><span>अभी बाकी है</span></div>
      </div>`,
      `<div class="wbw-rise t26"><span class="w">हर</span> <span class="w imp-gold">कदम</span> <span class="w">मायने</span> <span class="w">रखता है।</span></div>`,
      `<div class="wbw-rise t26"><span class="w">जो</span> <span class="w">सपना</span> <span class="w">देखा,</span> <span class="w imp-gold">वो</span> <span class="w">पाओ।</span></div>`,
    ]
  },
  {
    id: 't27', name: 'The Dusk', mood: 'Whispered', dot: '#a1a1aa',
    font: 'Caveat',
    style: { template_id: 't27', font_family: 'Caveat', font_size: 28, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t27-blur">some things are better left <span class="imp">unsaid</span></div>`,
      `<div class="t27-blur">the quiet between us said <span class="imp">everything</span></div>`,
      `<div class="plain-s t27">softly now.<br>just breathe.</div>`,
    ]
  },
  {
    id: 't28', name: 'The Anvil', mood: 'Impact', dot: '#39ff14',
    font: 'Unbounded',
    style: { template_id: 't28', font_family: 'Unbounded', font_size: 18, font_weight: '900', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t28-drop">ZERO <span class="imp">LIMITS</span></div>`,
      `<div class="t28-wipe">Every rep. Every day. <span class="imp">No days off.</span></div>`,
      `<div class="wbw-rise t28"><span class="w">Iron</span> <span class="w imp-green">sharpens</span> <span class="w">iron.</span></div>`,
    ]
  },
  {
    id: 't29', name: 'The Silk', mood: 'Luxury', dot: '#d4af37',
    font: 'Cinzel',
    style: { template_id: 't29', font_family: 'Cinzel', font_size: 18, font_weight: '900', text_case: 'uppercase', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t29-snap">CRAFTED FOR THE <span class="imp">FEW</span></div>`,
      `<div class="wbw-rise t29"><span class="w">Timeless.</span> <span class="w imp-gold">Rare.</span> <span class="w">Exquisite.</span></div>`,
      `<div class="wbw-slide t29"><span class="w">Only</span> <span class="w">the</span> <span class="w imp-gold">finest</span> <span class="w">will do.</span></div>`,
    ]
  },
  {
    id: 't30', name: 'The Glitch', mood: 'Cyberpunk', dot: '#a78bfa',
    font: 'Silkscreen',
    style: { template_id: 't30', font_family: 'Silkscreen', font_size: 14, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t30-loadbar">
        <div class="t30-loadbar-text">HACK THE <span class="imp">SYSTEM</span></div>
        <div class="t30-loadbar-bar"></div>
      </div>`,
      `<div class="t30-cpop">ERROR <span class="imp">404</span>: REALITY.EXE</div>`,
      `<div class="wbw-slide t30"><span class="w">Plug</span> <span class="w imp-purple">in.</span> <span class="w">Jack</span> <span class="w">out.</span></div>`,
    ]
  },
  {
    id: 't31', name: 'The Oath', mood: 'Spiritual', dot: '#d4af37',
    font: 'Bebas Neue',
    style: { template_id: 't31', font_family: 'Bebas Neue', font_size: 26, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t31-cluster">
        <div class="t31-rtop"><span>प्रण</span></div>
        <div class="t31-hl">DHARMA</div>
        <div class="t31-rbot"><span>सत्य की राह</span></div>
      </div>`,
      `<div class="t31-karaoke">सत्यमेव जयते — truth alone triumphs.</div>`,
      `<div class="wbw-rise t31"><span class="w">Walk</span> <span class="w imp-gold">the</span> <span class="w">righteous</span> <span class="w">path.</span></div>`,
    ]
  },
  {
    id: 't32', name: 'The Haze', mood: 'Lofi', dot: '#8b8b9e',
    font: 'Questrial',
    style: { template_id: 't32', font_family: 'Questrial', font_size: 20, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t32-slideup">studying at 2am with <span class="imp">nowhere</span> to be</div>`,
      `<div class="t32-slideup">coffee and <span class="imp">chill beats</span> forever</div>`,
      `<div class="plain-s t32">slow down.<br>the world<br>can wait.</div>`,
    ]
  },
  {
    id: 't33', name: 'The Arc', mood: 'Comedy', dot: '#d4af37',
    font: 'Noto Sans',
    style: { template_id: 't33', font_family: 'Noto Sans', font_size: 20, font_weight: '400', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t33-slideup">I said I'd be there in <span class="imp">5 minutes</span></div>`,
      `<div class="t33-cpop">that was <span class="imp">3 hours</span> ago</div>`,
      `<div class="wbw-rise t33"><span class="w">Nobody</span> <span class="w">saw</span> <span class="w imp-gold">that</span> <span class="w">coming.</span></div>`,
    ]
  },
  {
    id: 't34', name: 'The Ruin', mood: 'Dark Poetry', dot: '#ff3d71',
    font: 'Playfair Display',
    style: { template_id: 't34', font_family: 'Playfair Display', font_size: 20, font_weight: '400', font_style: 'italic', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t34-blur">Beauty is nothing but <span class="imp">the beginning of terror</span></div>`,
      `<div class="t34-frame">
        <div class="t34-bar"></div>
        <div class="t34-mid"><div class="t34-ttl">All that is <span class="em">broken</span><br>was once whole</div></div>
        <div class="t34-bar b2"></div>
      </div>`,
      `<div class="wbw-rise t34"><span class="w">Ruins</span> <span class="w">are</span> <span class="w imp-rose">sacred</span> <span class="w">too.</span></div>`,
    ]
  },
  {
    id: 't35', name: 'The Monument', mood: 'Epic', dot: '#ffffff',
    font: 'Cinzel',
    style: { template_id: 't35', font_family: 'Cinzel', font_size: 22, font_weight: '900', has_background: false, position_y: 75 },
    sentences: [
      `<div class="t35-cluster">
        <div class="t35-rtop"><span>in memoriam</span></div>
        <div class="t35-hl">ETERNITY</div>
        <div class="t35-rbot"><span>carved in stone</span></div>
      </div>`,
      `<div class="plain-s t35">They who dare<br>are remembered<br>forever.</div>`,
      `<div class="wbw-rise t35"><span class="w">Leave</span> <span class="w">a</span> <span class="w imp-bold">legacy.</span></div>`,
    ]
  },
]

/* ─── Template Card ───────────────────────────────────────────── */
function TemplateCard({ template, appliedId, onApply }) {
  const [slide, setSlide] = useState(0)
  const stageRef = useRef(null)
  const isApplied = appliedId === template.id

  // Cycle through sentences
  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % template.sentences.length), 2400)
    return () => clearInterval(id)
  }, [template.sentences.length])

  // Animate word-by-word elements (.w) when a sentence becomes active
  useEffect(() => {
    if (!stageRef.current) return
    const blocks = stageRef.current.querySelectorAll('.adv-sblock')
    blocks.forEach((block, i) => {
      const words = block.querySelectorAll('.w')
      if (i === slide) {
        words.forEach((w, j) => {
          w.classList.remove('in')
          setTimeout(() => w.classList.add('in'), j * 75 + 80)
        })
      } else {
        words.forEach(w => w.classList.remove('in'))
      }
    })
  }, [slide])

  return (
    <div
      className={`rounded-xl overflow-hidden cursor-pointer border transition-all duration-200 ${
        isApplied
          ? 'border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
          : 'border-white/5 hover:border-white/15'
      }`}
      onClick={() => onApply(template)}
    >
      {/* Preview stage */}
      <div className={`adv-stage ${template.id}`} ref={stageRef}>
        {template.sentences.map((html, i) => (
          <div
            key={i}
            className={`adv-sblock${slide === i ? ' active' : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ))}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900">
        <div>
          <p className="text-[11px] font-semibold text-white leading-tight">{template.name}</p>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">{template.mood}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: template.dot }} />
          {isApplied && <Check className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Tab ────────────────────────────────────────────────── */
export default function TemplatesTab2({ currentStyle, onApplyTemplate }) {
  const appliedId = currentStyle?.template_id ?? null

  // Load Google Fonts once
  useEffect(() => {
    if (document.getElementById('adv-fonts')) return
    const link = document.createElement('link')
    link.id = 'adv-fonts'
    link.rel = 'stylesheet'
    link.href = FONT_URL
    document.head.appendChild(link)
  }, [])

  const handleApply = (template) => {
    onApplyTemplate(template.style)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-white/5">
        <h2 className="text-[13px] font-semibold text-white">Advanced Templates</h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">35 cinematic styles — click to apply</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-3">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              appliedId={appliedId}
              onApply={handleApply}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
