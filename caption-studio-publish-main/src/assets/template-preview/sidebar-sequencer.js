// Template-card preview sequencer. Runs inside the sandboxed srcdoc frame
// built by SidebarTemplateGallery20.jsx buildPreviewDoc(); per-template values arrive in the
// #lekha-preview-config JSON block. The production CSP allows this exact
// text by hash: after editing it, run `npm run release:contracts` and copy
// the hash it reports into vite.config.js, firebase.json and netlify.toml.
const PREVIEW = JSON.parse(document.getElementById('lekha-preview-config').textContent);
(() => {
  const card = document.querySelector('.card');
  if (!card) return;
  const blocks = Array.from(card.querySelectorAll('.sb, .sblock'));
  const dots = Array.from(card.querySelectorAll('.dots i'));
  const label = card.querySelector('.slbl, .stage-lbl');
  // Gallery cards need obvious motion at a glance. The old 4.8-second
  // still frame made the templates look frozen before their next scene
  // was shown. Keep each caption readable, then move to the next line.
  const HOLD = 2200;
  const EXIT_MS = 560;
  const GAP = 120;
  const WBW_DELAY = 125;
  const WBW_DUR = 540;
  const POS_STAGGER = 320;
  const POS_DUR = 560;
  const WBW_CLASSES = ['wrise','wslide','wslider','wroll','wwipe','wwipeup','wfade','wscale','wflip','wbounce','wdiag','wexpand','wskew','wstencil','wlift','wbw-rise','wbw-slide'];
  const IMP_ANIMS = {
        'imp-bold':'drop',
        'imp-gold':'wipe',
        'imp-rose':'diagonal-wipe',
        'imp-cyan':'skew-snap',
        'imp-green':'pop',
        'imp-purple':'roll',
        'imp-italic':'lift',
        'imp-weight':'stamp',
        'imp-underline':'wipe-up',
        'imp-box':'drift',
        'imp-space':'stencil',
        'imp-flicker':'flicker',
        'imp-typewrite':'typewrite',
        'imp-stamp':'stamp'
      };
  let currentIndex = 0;
  let timer = null;
  const animationTimers = new Set();
  const setTimeout = (fn, delay) => {
    const id = window.setTimeout(() => {
      animationTimers.delete(id);
      fn();
    }, delay);
    animationTimers.add(id);
    return id;
  };

  function clearAnimationTimers() {
    animationTimers.forEach((id) => window.clearTimeout(id));
    animationTimers.clear();
  }

  const getLcMotionSchedule = window.getLcMotionSchedule;

  function getLcAnimation(element, fallbackDuration) {
    const anim = element && element.dataset ? (element.dataset.lcAnim || '') : '';
    if (!anim) return null;
    const duration = Number(element.dataset.lcDuration);
    const delay = Number(element.dataset.lcDelay);
    return {
      anim,
      duration: Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration,
      ease: element.dataset.lcEase || 'cubic-bezier(.22,.68,.26,1)',
      delay: Number.isFinite(delay) && delay >= 0 ? delay : null
    };
  }

  function emitProgress(index) {
    try {
      window.parent.postMessage({
        type: PREVIEW.progressEvent,
        templateId: PREVIEW.templateId,
        activeIndex: index,
        total: Math.max(dots.length, blocks.length),
      }, '*');
    } catch (error) {
      void error;
    }
  }

  function getBlockType(block) {
    if (block.querySelector('[data-lc-anim], [data-lc-block-anim]')) return 'lc';
    const wbwSelector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
    if (block.querySelector(wbwSelector)) return 'wbw';
    if (block.querySelector('.sw, .sw-w')) return 'pos';
    if (block.querySelector('.plain-s')) return 'plain';
    return 'plain';
  }

  function wbwInitWord(word) {
    const parent = word.parentElement;
    word.style.transition = 'none';
    word.style.clipPath = 'inset(0 0 0 0)';
    word.style.transformOrigin = '';
    word.style.filter = '';
    if (getLcAnimation(word, WBW_DUR)) {
      word.style.animation = 'none';
      word.style.transform = 'none';
      word.style.clipPath = '';
      word.style.opacity = '0';
      return;
    }
    if (parent.classList.contains('wrise') || parent.classList.contains('wbw-rise')) { word.style.transform = 'translateY(22px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wslide') || parent.classList.contains('wbw-slide')) { word.style.transform = 'translateX(-26px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wslider')) { word.style.transform = 'translateX(26px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wroll')) { word.style.transform = 'translateY(14px) rotate(-6deg)'; word.style.transformOrigin = 'left bottom'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wwipe')) { word.style.clipPath = 'inset(0 100% 0 0)'; word.style.transform = 'none'; word.style.opacity = '1'; }
    else if (parent.classList.contains('wwipeup')) { word.style.clipPath = 'inset(100% 0 0 0)'; word.style.transform = 'none'; word.style.opacity = '1'; }
    else if (parent.classList.contains('wfade')) { word.style.transform = 'none'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wscale')) { word.style.transform = 'scale(0.5)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wflip')) { word.style.transform = 'rotateX(-80deg)'; word.style.transformOrigin = 'center bottom'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wbounce')) { word.style.transform = 'translateY(-22px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wdiag')) { word.style.transform = 'translate(-16px,16px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wexpand')) { word.style.transform = 'scaleX(0.15)'; word.style.transformOrigin = 'center'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wskew')) { word.style.transform = 'skewX(-18deg) translateX(-12px)'; word.style.opacity = '0'; }
    else if (parent.classList.contains('wstencil')) { word.style.clipPath = 'inset(0 50% 0 50%)'; word.style.transform = 'none'; word.style.opacity = '1'; }
    else if (parent.classList.contains('wlift')) { word.style.transform = 'translateY(-22px)'; word.style.opacity = '0'; }
    else { word.style.transform = 'none'; word.style.opacity = '0'; }
  }

  function wbwAnimWord(word, delay) {
    const lcAnimation = getLcAnimation(word, WBW_DUR);
    const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
    setTimeout(() => {
      if (lcAnimation) {
        word.style.transition = 'none';
        word.style.transform = 'none';
        word.style.clipPath = '';
        word.style.opacity = '';
        word.style.animation = lcAnimation.anim + ' ' + lcAnimation.duration + 'ms ' + lcAnimation.ease + ' 0ms forwards';
        word.classList.add('in');
        return;
      }
      const parent = word.parentElement;
      let transition = 'transform ' + WBW_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + (WBW_DUR - 40) + 'ms ease';
      if (parent.classList.contains('wwipe') || parent.classList.contains('wwipeup') || parent.classList.contains('wstencil')) {
        transition = 'clip-path ' + WBW_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
      }
      word.style.transition = transition;
      word.style.transform = 'none';
      word.style.opacity = '1';
      word.style.clipPath = 'inset(0 0 0 0)';
      word.classList.add('in');
    }, playbackDelay);
  }

  function wbwAnimIMP(word, delay) {
    const impClass = Array.from(word.classList).find((className) => IMP_ANIMS[className]);
    if (!impClass) return false;

    const impType = IMP_ANIMS[impClass];
    const d = delay + 120;
    const dur = WBW_DUR + 160;
    const ease = 'cubic-bezier(0.22,1,0.36,1)';

    word.style.transition = 'none';
    word.style.clipPath = 'inset(0 0 0 0)';

    if (impType === 'wipe') {
      word.style.clipPath = 'inset(0 100% 0 0)';
      word.style.opacity = '1';
      word.style.transform = 'none';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
        word.style.clipPath = 'inset(0 0 0 0)';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'wipe-up') {
      word.style.clipPath = 'inset(100% 0 0 0)';
      word.style.opacity = '1';
      word.style.transform = 'none';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
        word.style.clipPath = 'inset(0 0 0 0)';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'diagonal-wipe') {
      word.style.clipPath = 'polygon(0 0,0 0,0 100%,0 100%)';
      word.style.opacity = '1';
      word.style.transform = 'none';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
        word.style.clipPath = 'polygon(0 0,100% 0,100% 100%,0 100%)';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'blur-sharpen') {
      word.style.transform = 'none';
      word.style.opacity = '0.4';
      word.style.filter = 'blur(6px)';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'filter ' + dur + 'ms ease, opacity ' + (dur - 60) + 'ms ease';
        word.style.filter = 'blur(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'stencil') {
      word.style.clipPath = 'inset(0 50% 0 50%)';
      word.style.opacity = '1';
      word.style.transform = 'none';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
        word.style.clipPath = 'inset(0 0 0 0)';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'skew-snap') {
      word.style.transform = 'skewX(-18deg) translateX(-12px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'skewX(0) translateX(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'roll') {
      word.style.transformOrigin = 'center bottom';
      word.style.transform = 'rotateX(-90deg)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 80) + 'ms ease';
        word.style.transform = 'rotateX(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'rotate-in') {
      word.style.transformOrigin = 'left bottom';
      word.style.transform = 'rotate(-8deg) translateY(10px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'rotate(0) translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'drop') {
      word.style.transform = 'translateY(-30px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'drop-in') {
      word.style.transform = 'translateY(-30px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.34,1.56,0.64,1), opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'pop') {
      word.style.transform = 'scale(0.82)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'scale(1)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'elastic') {
      word.style.transform = 'translateY(35px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + (dur + 80) + 'ms cubic-bezier(0.34,1.56,0.64,1), opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'lift') {
      word.style.transform = 'translateY(-20px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'drift') {
      word.style.transform = 'translateX(-12px) translateY(8px)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'transform ' + (dur + 30) + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
        word.style.transform = 'translateX(0) translateY(0)';
        word.style.opacity = '1';
        word.classList.add('in');
      }, d);
      return true;
    }

    if (impType === 'stamp') {
      word.style.transform = 'scale(1.3)';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'none';
        word.style.opacity = '1';
        word.style.transform = 'scale(1.3)';
        setTimeout(() => {
          word.style.transition = 'transform 180ms ' + ease;
          word.style.transform = 'scale(1)';
          word.classList.add('in');
        }, 60);
      }, d);
      return true;
    }

    if (impType === 'typewrite') {
      word.style.transform = 'none';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'opacity ' + WBW_DUR + 'ms ease';
        word.style.opacity = '1';
        word.classList.add('in');
        setTimeout(() => word.classList.add('fx'), WBW_DUR + 50);
      }, d);
      return true;
    }

    if (impType === 'flicker') {
      word.style.transform = 'none';
      word.style.opacity = '0';
      void word.offsetHeight;
      setTimeout(() => {
        word.style.transition = 'opacity 40ms';
        word.style.opacity = '1';
        word.classList.add('in');
        setTimeout(() => word.classList.add('fx'), 50);
      }, d);
      return true;
    }

    return false;
  }

  function animateWBW(block) {
    const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
    const words = block.querySelectorAll(selector);
    if (!words.length) return;
    words.forEach((word) => wbwInitWord(word));
    void block.offsetHeight;
    words.forEach((word, index) => {
      const handled = wbwAnimIMP(word, index * WBW_DELAY);
      if (!handled) wbwAnimWord(word, index * WBW_DELAY);
    });
  }

  function resetWBW(block) {
    const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
    block.querySelectorAll(selector).forEach((word) => {
      word.classList.remove('in', 'fx');
      wbwInitWord(word);
    });
  }

  function posInitWord(word) {
    if (getLcAnimation(word, POS_DUR)) {
      word.style.transition = 'none';
      word.style.animation = 'none';
      word.style.clipPath = '';
      word.style.transformOrigin = '';
      word.style.transform = 'none';
      word.style.opacity = '0';
      return;
    }
    const anim = word.dataset.anim || 'rise';
    word.style.transition = 'none';
    word.style.clipPath = '';
    word.style.transformOrigin = '';
    switch (anim) {
      case 'rise': word.style.transform = 'translateY(20px)'; word.style.opacity = '0'; break;
      case 'drop': word.style.transform = 'translateY(-28px)'; word.style.opacity = '0'; break;
      case 'fade': word.style.transform = 'none'; word.style.opacity = '0'; break;
      case 'slide-l': word.style.transform = 'translateX(-28px)'; word.style.opacity = '0'; break;
      case 'slide-r': word.style.transform = 'translateX(28px)'; word.style.opacity = '0'; break;
      case 'slide-slow': word.style.transform = 'translateX(-32px)'; word.style.opacity = '0'; break;
      case 'pop': word.style.transform = 'scale(0.82)'; word.style.opacity = '0'; break;
      case 'lift': word.style.transform = 'translateY(-16px)'; word.style.opacity = '0'; break;
      case 'drift': word.style.transform = 'translateX(-12px) translateY(8px)'; word.style.opacity = '0'; break;
      case 'bounce': word.style.transform = 'translateY(-20px)'; word.style.opacity = '0'; break;
      case 'wipe': word.style.clipPath = 'inset(0 100% 0 0)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
      case 'wipe-up': word.style.clipPath = 'inset(100% 0 0 0)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
      case 'diagonal': word.style.transform = 'translate(-12px, 12px)'; word.style.opacity = '0'; break;
      case 'diagonal-wipe': word.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
      case 'roll': word.style.transform = 'translateY(12px) rotate(-6deg)'; word.style.opacity = '0'; word.style.transformOrigin = 'left bottom'; break;
      case 'skew-snap': word.style.transform = 'skewX(-18deg) translateX(-10px)'; word.style.opacity = '0'; break;
      case 'stencil': word.style.clipPath = 'inset(0 50% 0 50%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
      default: word.style.transform = 'translateY(20px)'; word.style.opacity = '0'; break;
    }
  }

  function posAnimWord(word, delay) {
    const lcAnimation = getLcAnimation(word, POS_DUR);
    const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
    setTimeout(() => {
      if (lcAnimation) {
        word.style.transition = 'none';
        word.style.transform = 'none';
        word.style.clipPath = '';
        word.style.opacity = '';
        word.style.animation = lcAnimation.anim + ' ' + lcAnimation.duration + 'ms ' + lcAnimation.ease + ' 0ms forwards';
        word.classList.add('in');
        return;
      }
      const anim = word.dataset.anim || 'rise';
      let transition = 'transform ' + POS_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + (POS_DUR - 40) + 'ms ease';
      if (anim === 'wipe' || anim === 'wipe-up' || anim === 'diagonal-wipe' || anim === 'stencil') {
        transition = 'clip-path ' + POS_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
      } else if (anim === 'slide-slow') {
        transition = 'transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 550ms ease';
      }
      word.style.transition = transition;
      word.style.transform = 'none';
      word.style.opacity = '1';
      if (anim === 'diagonal-wipe') {
        word.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
      } else {
        word.style.clipPath = 'inset(0 0 0 0)';
      }
      word.classList.add('in');
    }, playbackDelay);
  }

  function animatePosWords(block) {
    const words = block.querySelectorAll('.sw');
    if (!words.length) return;
    words.forEach((word) => posInitWord(word));
    void block.offsetHeight;
    words.forEach((word, index) => posAnimWord(word, index * POS_STAGGER));
  }

  function resetPosWords(block) {
    block.querySelectorAll('.sw').forEach((word) => {
      word.classList.remove('in');
      posInitWord(word);
    });
  }

  function resetBlock(block) {
    clearAnimationTimers();
    block.classList.remove('active');
    block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
    resetWBW(block);
    resetPosWords(block);
  }

  function stampLcMotion(block) {
    const nodes = Array.from(block.querySelectorAll('[data-lc-anim]'));
    const schedule = getLcMotionSchedule(nodes.map((node) => ({
      animation: node.dataset.lcAnim,
      duration: node.dataset.lcDuration,
      delay: node.dataset.lcDelay,
      ease: node.dataset.lcEase,
    })));

    nodes.forEach((node) => {
      node.style.animation = 'none';
      node.style.transition = 'none';
      node.style.opacity = '';
      node.style.transform = '';
      node.style.clipPath = '';
      node.classList.remove('in', 'visible');
    });
    void block.getBoundingClientRect();
    nodes.forEach((node, index) => {
      const entry = schedule.entries[index];
      if (!entry || !entry.animation) return;
      node.style.animation = entry.animation + ' ' + entry.durationMs + 'ms ' + entry.ease + ' ' + entry.delayMs + 'ms both';
    });

    block.querySelectorAll('[data-lc-block-anim]').forEach((node) => {
      const schedule = getLcMotionSchedule([{
        animation: node.dataset.lcBlockAnim,
        duration: node.dataset.lcBlockDuration,
        delay: node.dataset.lcBlockDelay,
        ease: node.dataset.lcBlockEase,
      }]);
      const entry = schedule.entries[0];
      if (!entry || !entry.animation) return;
      node.style.animation = 'none';
      void node.getBoundingClientRect();
      node.style.animation = entry.animation + ' ' + entry.durationMs + 'ms ' + entry.ease + ' ' + entry.delayMs + 'ms both';
    });

    block.querySelectorAll('.w.on, .sw.on, .sw-w.on').forEach((node) => {
      node.style.animation = 'none';
      node.style.opacity = '1';
      node.style.transform = 'none';
      node.style.clipPath = 'inset(0 0 0 0)';
    });
    block.querySelectorAll('.plainwrap').forEach((node) => {
      node.style.animation = 'none';
      void node.getBoundingClientRect();
      node.style.animation = 'fade 240ms ease 0ms both';
    });
  }

  function enterBlock(block) {
    const type = getBlockType(block);
    resetBlock(block);
    void block.offsetHeight;
    if (type === 'lc') {
      block.style.transition = 'none';
      block.style.visibility = 'visible';
      block.style.pointerEvents = 'auto';
      block.style.opacity = '1';
      block.classList.add('active');
      stampLcMotion(block);
    } else if (type === 'plain') {
      block.style.transition = 'none';
      block.style.visibility = 'visible';
      block.style.pointerEvents = 'auto';
      block.style.opacity = '1';
      block.classList.add('active');
      block.querySelectorAll('.plainwrap').forEach((element) => {
        element.style.animation = 'none';
        element.style.opacity = '0';
        void element.offsetWidth;
        element.style.animation = '';
      });
      block.querySelectorAll('[data-lc-block-anim]').forEach((element) => {
        element.style.animation = 'none';
        void element.offsetWidth;
        element.style.animation = element.dataset.lcBlockAnim + ' '
          + (element.dataset.lcBlockDuration || 560) + 'ms '
          + (element.dataset.lcBlockEase || 'cubic-bezier(.22,.68,.26,1)') + ' 0ms both';
      });
    } else if (type === 'wbw') {
      block.style.transition = 'none';
      block.style.visibility = 'visible';
      block.style.pointerEvents = 'auto';
      block.style.opacity = '1';
      block.classList.add('active');
      requestAnimationFrame(() => requestAnimationFrame(() => animateWBW(block)));
    } else {
      block.style.transition = 'none';
      block.style.visibility = 'visible';
      block.style.pointerEvents = 'auto';
      block.style.opacity = '1';
      block.classList.add('active');
      requestAnimationFrame(() => requestAnimationFrame(() => animatePosWords(block)));
    }
  }

  function exitBlock(block, callback) {
    const type = getBlockType(block);
    if (type === 'plain') {
      block.style.transition = 'none';
      block.style.opacity = '0';
      requestAnimationFrame(() => {
        block.classList.remove('active');
        block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
        setTimeout(callback, GAP);
      });
      return;
    }
    block.style.transition = 'opacity ' + EXIT_MS + 'ms ease';
    block.style.opacity = '0';
    setTimeout(() => {
      block.classList.remove('active');
      block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
      resetWBW(block);
      resetPosWords(block);
      setTimeout(callback, GAP);
    }, EXIT_MS);
  }

  function show(index) {
    const block = blocks[index];
    if (!block) return;
    blocks.forEach((otherBlock, otherIndex) => {
      if (otherIndex !== index) {
        otherBlock.classList.remove('active');
        otherBlock.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
      }
    });
    dots.forEach((dot, dotIndex) => dot.classList.toggle('on', dotIndex === index));
    emitProgress(index);
    if (label) {
      const nextLabel = block.dataset.label
        || (block.querySelector('.plain-s') ? 'Plain' : '')
        || (block.querySelector('.wbw, .wbw-rise, .wbw-slide') ? 'Word by Word' : '');
      if (nextLabel) label.textContent = nextLabel;
    }
    enterBlock(block);
  }

  function cycle() {
    exitBlock(blocks[currentIndex], () => {
      currentIndex = (currentIndex + 1) % blocks.length;
      show(currentIndex);
      timer = window.setTimeout(cycle, HOLD);
    });
  }

  function jumpTo(index) {
    if (!blocks[index]) return;
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    clearAnimationTimers();
    blocks.forEach((block) => resetBlock(block));
    currentIndex = index;
    show(currentIndex);
    if (blocks.length > 1) {
      timer = window.setTimeout(cycle, HOLD);
    }
  }

  blocks.forEach((block) => resetBlock(block));
  currentIndex = 0;
  show(currentIndex);
  if (blocks.length > 1) {
    timer = window.setTimeout(cycle, HOLD);
  }

  dots.forEach((dot, dotIndex) => {
    dot.setAttribute('role', 'button');
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('aria-label', 'Play caption line ' + (dotIndex + 1));
    dot.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      jumpTo(dotIndex);
    });
    dot.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        jumpTo(dotIndex);
      }
    });
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== PREVIEW.jumpEvent || data.templateId !== PREVIEW.templateId) return;
    const index = Number(data.activeIndex);
    if (!Number.isFinite(index) || !blocks[index]) return;
    jumpTo(index);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) {
      window.clearTimeout(timer);
      clearAnimationTimers();
      timer = null;
    } else if (!document.hidden && !timer && blocks.length > 1) {
      blocks.forEach((block) => resetBlock(block));
      show(currentIndex);
      timer = window.setTimeout(cycle, HOLD);
    }
  });
})();
