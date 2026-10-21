// Template-card preview sequencer. Runs inside the sandboxed srcdoc frame
// built by AdvancedTemplateLibrary.jsx buildPreviewDoc(); per-template values arrive in the
// #lekha-preview-config JSON block. The production CSP allows this exact
// text by hash: after editing it, run `npm run release:contracts` and copy
// the hash it reports into vite.config.js, firebase.json and netlify.toml.
const PREVIEW = JSON.parse(document.getElementById('lekha-preview-config').textContent);
(() => {
  document.documentElement.classList.add('template-preview-script-ready');
  const HOLD = PREVIEW.timing.holdMs;
  const EXIT = PREVIEW.timing.exitMs;
  const ENTER = PREVIEW.timing.enterMs;
  const GAP = PREVIEW.timing.gapMs;
  const INITIAL_BLOCK_INDEX = PREVIEW.initialBlockIndex;
  const LOCK_TO_PHASE = PREVIEW.lockToPhase;
  // T41-T52 animate only through authored CSS keyframes keyed on
  // .active, so the preview restarts them instead of driving words.
  const KEYFRAME_TEMPLATE = PREVIEW.keyframeTemplate;
  const APPLIED_PREVIEW = PREVIEW.appliedPreview;
  let runToken = 0;
  let activeBlockIndex = INITIAL_BLOCK_INDEX;
  let pendingTimers = [];
  const IMP_ENTRANCES = PREVIEW.impEntrances;
  const IMP_CLASS_PATTERN = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/g;
  const IMP_CLASS_TEST_PATTERN = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/;

  function schedule(callback, delay) {
    const timer = setTimeout(() => {
      pendingTimers = pendingTimers.filter((item) => item !== timer);
      callback();
    }, delay);
    pendingTimers.push(timer);
    return timer;
  }

  function clearPendingTimers() {
    pendingTimers.forEach((timer) => clearTimeout(timer));
    pendingTimers = [];
  }

  function hideBlock(block) {
    if (!block) return;
    block.classList.remove('active');
    block.style.transition = 'none';
    block.style.opacity = '0';
    block.style.visibility = 'hidden';
    block.style.zIndex = '0';
    resetWords(block);
  }

  function enforceSingleBlock(blocks, activeIndex) {
    blocks.forEach((block, index) => {
      if (!block) return;
      if (index === activeIndex) {
        block.style.visibility = 'visible';
        block.style.zIndex = '2';
        if (!block.classList.contains('active')) block.classList.add('active');
        if (block.dataset.type === 'plain') block.style.opacity = '1';
        return;
      }
      hideBlock(block);
    });
  }

  function buildWBW(container) {
    const el = container;
    const rawText = el.getAttribute('data-text');
    if (!rawText) return;
    el.innerHTML = '';
    const parts = rawText.split(/(\{[^}]+\}|\s+)/);
    let idx = 0;
    parts.forEach((part) => {
      if (!part) return;
      if (/^(\s+)$/.test(part)) {
        el.appendChild(document.createTextNode(' '));
        return;
      }
      const impMatch = part.match(/^\{([^:]+):(.+)\}$/);
      if (impMatch) {
        const cls = impMatch[1];
        const word = impMatch[2];
        const span = document.createElement('span');
        span.className = 'w ' + cls;
        span.textContent = word;
        span.dataset.i = idx++;
        span.dataset.imp = 'true';
        span.dataset.impCls = cls;
        el.appendChild(span);
        return;
      }
      const words = part.split(' ');
      words.forEach((word, wordIndex) => {
        if (!word) return;
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = word;
        span.dataset.i = idx++;
        el.appendChild(span);
        if (wordIndex < words.length - 1) {
          el.appendChild(document.createTextNode(' '));
        }
      });
    });
  }

  function cleanClass(value, fallback) {
    const cleaned = String(value || '')
      .split(/\s+/)
      .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in', 'fx'].includes(className))
      .join(' ');
    return cleaned || fallback;
  }

  function mappedClass(sourceClasses, index, total, fallback) {
    if (!sourceClasses.length) return fallback;
    if (total <= 1) return sourceClasses[0] || fallback;
    const sourceIndex = Math.min(
      sourceClasses.length - 1,
      Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
    );
    return sourceClasses[sourceIndex] || fallback;
  }

  function replacePreviewWbw(container, words) {
    if (!container || !words.length) return;
    const sourceWords = Array.from(container.querySelectorAll('.w'));
    const sourceClasses = sourceWords.map((word) => cleanClass(word.className, 'w'));
    const sourceImpIndex = sourceWords.findIndex((word) => (
      word.dataset.imp === 'true' || IMP_CLASS_TEST_PATTERN.test(word.className || '')
    ));
    const sourceImpClass = sourceImpIndex >= 0
      ? sourceWords[sourceImpIndex].dataset.impCls
        || (sourceClasses[sourceImpIndex].match(IMP_CLASS_TEST_PATTERN) || [])[0]
        || ''
      : '';
    const rawImpWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
    const impWordIndex = Number.isFinite(rawImpWordIndex) && rawImpWordIndex >= 0
      ? rawImpWordIndex
      : (sourceImpIndex >= 0 ? Math.min(words.length - 1, sourceImpIndex) : -1);
    const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
    const resolvedImpClass = sourceImpClass || (PREVIEW.templateId === 't39' ? 'imp-rose' : '');

    container.textContent = '';
    container.dataset.text = words.join(' ');
    words.forEach((word, index) => {
      if (index > 0) container.appendChild(document.createTextNode(' '));
      const span = document.createElement('span');
      const mapped = mappedClass(sourceClasses, index, words.length, 'w')
        .replace(IMP_CLASS_PATTERN, '')
        .replace(/\s+/g, ' ')
        .trim();
      const isImp = index === impWordIndex && !!resolvedImpClass;
      span.className = (mapped || 'w') + (isImp ? ' ' + resolvedImpClass + ' is-emphasis' : '');
      span.dataset.i = String(index);
      if (isImp) {
        span.dataset.imp = 'true';
        span.dataset.impCls = resolvedImpClass;
        if (emphasisColor) {
          span.style.setProperty('color', emphasisColor, 'important');
          span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
        }
      }
      span.textContent = word;
      container.appendChild(span);
    });
  }

  function replacePreviewKaraoke(container, words) {
    if (!container || !words.length) return;
    container.textContent = '';
    words.forEach((word, index) => {
      if (index > 0) container.appendChild(document.createTextNode(' '));
      const wrapper = document.createElement('span');
      wrapper.className = 'kf-word';
      const base = document.createElement('span');
      base.className = 'kf-base';
      base.textContent = word;
      const fill = document.createElement('span');
      fill.className = 'kf-fill';
      fill.textContent = word;
      wrapper.append(base, fill);
      container.appendChild(wrapper);
    });
  }

  function collectPreviewTextNodes(root) {
    const textNodes = [];
    const visit = (node) => {
      Array.from(node.childNodes || []).forEach((child) => {
        if (child.nodeType === 3) {
          if (/[\p{L}\p{N}]/u.test(child.nodeValue || '')) textNodes.push(child);
          else if (String(child.nodeValue || '').trim()) child.nodeValue = '';
        } else if (child.nodeType === 1) {
          visit(child);
        }
      });
    };
    visit(root);
    return textNodes;
  }

  function assignPreviewWordsToSlots(words, slotCount) {
    const assigned = Array.from({ length: Math.max(0, slotCount) }, () => []);
    if (!words.length || !assigned.length) return assigned;
    words.forEach((word, wordIndex) => {
      const slotIndex = words.length <= 1 || assigned.length <= 1
        ? 0
        : Math.min(
          assigned.length - 1,
          Math.round((wordIndex * (assigned.length - 1)) / Math.max(1, words.length - 1)),
        );
      assigned[slotIndex].push({ word, wordIndex });
    });
    return assigned;
  }

  function findPreviewImpWrapper(slot, block) {
    let element = slot?.parentElement;
    while (element && element !== block) {
      if (IMP_CLASS_TEST_PATTERN.test(String(element.className || ''))) return element;
      element = element.parentElement;
    }
    return null;
  }

  function getPreviewSourceImpClass(block) {
    const className = Array.from(block.querySelectorAll('*'))
      .map((element) => element.className || '')
      .find((value) => IMP_CLASS_TEST_PATTERN.test(String(value)));
    return String(className || '').match(IMP_CLASS_TEST_PATTERN)?.[0] || 'imp-gold';
  }

  function replacePreviewTextSlot(slot, assignedWords, impWordIndex, impClass, emphasisColor, block) {
    const source = String(slot.nodeValue || '');
    const leading = /^\s/.test(source) ? ' ' : '';
    const trailing = /\s$/.test(source) ? ' ' : '';
    const replacementTarget = impWordIndex >= 0 ? findPreviewImpWrapper(slot, block) : null;
    const fragment = document.createDocumentFragment();
    if (leading) fragment.appendChild(document.createTextNode(leading));
    assignedWords.forEach(({ word, wordIndex }, localIndex) => {
      if (localIndex > 0) fragment.appendChild(document.createTextNode(' '));
      if (wordIndex === impWordIndex) {
        const span = document.createElement('span');
        span.className = impClass + ' is-emphasis';
        span.dataset.w = String(wordIndex);
        span.dataset.imp = 'true';
        span.dataset.impCls = impClass;
        if (emphasisColor) {
          span.style.setProperty('color', emphasisColor, 'important');
          span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
        }
        span.textContent = word;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(word));
      }
    });
    if (trailing) fragment.appendChild(document.createTextNode(trailing));
    if (replacementTarget?.parentNode) {
      replacementTarget.parentNode.replaceChild(fragment, replacementTarget);
    } else {
      slot.parentNode?.replaceChild(fragment, slot);
    }
  }

  function replacePreviewStyledText(block, words) {
    const slots = collectPreviewTextNodes(block);
    if (!slots.length) {
      block.textContent = APPLIED_PREVIEW.text;
      return;
    }
    const targetSlotCount = Math.max(1, Math.min(words.length, slots.length));
    const targetSlots = slots.slice(0, targetSlotCount);
    const assigned = assignPreviewWordsToSlots(words, targetSlots.length);
    const impClass = getPreviewSourceImpClass(block);
    const impWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
    const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
    targetSlots.forEach((slot, slotIndex) => {
      if (assigned[slotIndex]?.length) {
        replacePreviewTextSlot(slot, assigned[slotIndex], impWordIndex, impClass, emphasisColor, block);
      } else {
        slot.nodeValue = '';
      }
    });
    slots.slice(targetSlotCount).forEach((slot) => {
      slot.nodeValue = '';
    });
    block.querySelectorAll('[data-text]').forEach((element) => {
      element.setAttribute('data-text', APPLIED_PREVIEW.text || '');
    });
  }

  function injectAppliedPreviewCaption(blocks) {
    const captionText = String(APPLIED_PREVIEW.text || '').trim();
    if (!captionText) return;
    const words = captionText.split(/\s+/).filter(Boolean);
    if (!words.length) return;

    blocks.forEach((block) => {
      if (!block) return;
      const wbwContainers = Array.from(block.querySelectorAll('.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade, .wbw-seq-flip'));
      if (wbwContainers.length) {
        wbwContainers.forEach((container) => replacePreviewWbw(container, words));
        return;
      }
      const karaokeContainers = Array.from(block.querySelectorAll('.kf-line'));
      if (karaokeContainers.length) {
        karaokeContainers.forEach((container) => replacePreviewKaraoke(container, words));
        return;
      }
      replacePreviewStyledText(block, words);
    });
  }

  function applyStillFramesPreviewHighlight(blocks) {
    if (PREVIEW.templateId !== 't40') return;
    blocks.forEach((block) => {
      if (!block || block.querySelector('.still-frames-highlight')) return;
      const target = block.querySelector('.lekha-template-fit, span') || block;
      const words = String(target.textContent || '').trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const rawImpWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
      const impWordIndex = Number.isFinite(rawImpWordIndex) && rawImpWordIndex >= 0
        ? Math.min(words.length - 1, rawImpWordIndex)
        : Math.min(1, words.length - 1);
      const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
      target.textContent = '';
      target.classList.add('lekha-template-fit', 'still-frames-line');
      words.forEach((word, index) => {
        if (index > 0) target.appendChild(document.createTextNode(' '));
        if (index === impWordIndex) {
          const span = document.createElement('span');
          span.className = 'imp-rose still-frames-highlight is-emphasis';
          span.dataset.imp = 'true';
          span.dataset.impCls = 'imp-rose';
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
          span.textContent = word;
          target.appendChild(span);
        } else {
          target.appendChild(document.createTextNode(word));
        }
      });
    });
  }

  function resetWords(block) {
    if (KEYFRAME_TEMPLATE) {
      block.querySelectorAll('.w').forEach((word) => {
        word.classList.remove('in', 'fx');
        ['opacity', 'transform', 'clip-path', 'transform-origin', 'transition'].forEach((property) => {
          word.style.removeProperty(property);
        });
      });
      return;
    }
    block.querySelectorAll('.w').forEach((word) => {
      word.classList.remove('in', 'fx');
      word.style.opacity = '0';
      word.style.transform = '';
      word.style.clipPath = '';
      word.style.transformOrigin = '';
      word.style.transition = '';
    });
    block.querySelectorAll('.imp-underline').forEach((el) => {
      el.classList.remove('in');
    });
    block.querySelectorAll('.kf-fill').forEach((fill) => {
      fill.style.transition = 'none';
      fill.style.clipPath = 'inset(0 100% 0 0)';
    });
  }

  function animateWordsIn(block) {
    const token = runToken;
    const wordLine = block.querySelector('.wbw-rise, .wbw-seq-flip, .wbw-seq-fade, .wbw-seq, .wbw-slide');
    const type = !wordLine
      ? 'slide'
      : wordLine.classList.contains('wbw-rise')
        ? 'rise'
        : wordLine.classList.contains('wbw-seq-flip')
          ? 'seq-flip'
          : wordLine.classList.contains('wbw-seq-fade')
            ? 'seq-fade'
            : wordLine.classList.contains('wbw-seq')
              ? 'seq'
              : 'slide';
    const isSeq = type === 'seq' || type === 'seq-flip' || type === 'seq-fade';
    const stagger = isSeq
      ? PREVIEW.timing.sequentialStaggerMs
      : PREVIEW.timing.wordStaggerMs;
    const words = block.querySelectorAll('.w');
    words.forEach((word) => {
      const isEvidenceEmphasis = PREVIEW.templateId === 't39' && !!word.dataset.imp;
      word.classList.remove('in', 'fx');
      word.style.opacity = '0';
      word.style.clipPath = '';
      word.style.transformOrigin = '';
      if (type === 'rise') word.style.transform = 'translateY(20px)';
      else if (type === 'slide' && !word.dataset.imp) word.style.transform = 'translateX(-16px)';
      else if (type === 'seq') word.style.transform = 'scale(0.82)';
      else if (type === 'seq-fade') {
        word.style.transform = isEvidenceEmphasis
          ? 'translateY(18px) scale(0.72) rotate(-2deg)'
          : 'none';
      }
      else if (type === 'seq-flip') {
        word.style.transform = 'perspective(320px) rotateX(-90deg)';
        word.style.transformOrigin = 'center bottom';
      }
    });
    void block.offsetHeight;

    words.forEach((word, fallbackIndex) => {
      const isImp = !!word.dataset.imp;
      const isEvidenceEmphasis = PREVIEW.templateId === 't39' && isImp;
      const impCls = word.dataset.impCls || '';
      const parsedIndex = parseInt(word.dataset.i, 10);
      const index = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
      const delay = isSeq
        ? index * stagger
        : (index * stagger) + (isImp ? PREVIEW.timing.emphasisDelayMs : 0);
      const dur = isSeq
        ? PREVIEW.timing.sequentialDurationMs
        : isImp
          ? PREVIEW.timing.emphasisDurationMs
          : PREVIEW.timing.wordDurationMs;
      const entrance = !isSeq && isImp ? (IMP_ENTRANCES[impCls] || 'opposite') : null;

      schedule(() => {
        if (token !== runToken || !block.classList.contains('active')) return;
        if (isSeq) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (token !== runToken || !block.classList.contains('active')) return;
              if (type === 'seq-fade') {
                word.style.transition = isEvidenceEmphasis
                  ? 'opacity ' + dur + 'ms ease, transform ' + Math.max(320, dur) + 'ms cubic-bezier(0.18,1.45,0.35,1)'
                  : 'opacity ' + dur + 'ms ease';
                if (isEvidenceEmphasis) word.style.transform = 'translateY(0) scale(1) rotate(0deg)';
              } else {
                word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.4,0.64,1)';
                word.style.transform = type === 'seq-flip'
                  ? 'perspective(320px) rotateX(0)'
                  : 'scale(1)';
              }
              word.style.opacity = '1';
              word.classList.add('in');
            });
          });
          return;
        }

        if (isImp) {
          let initTransform = '';
          let initClip = '';
          let initOrigin = '';
          const eff = entrance === 'opposite' ? (type === 'rise' ? 'opposite-slide' : 'opposite-rise') : entrance;
          if (eff === 'opposite-slide') initTransform = 'translateX(-28px)';
          else if (eff === 'opposite-rise') initTransform = 'translateY(28px)';
          else if (eff === 'roll') { initTransform = 'rotateX(-90deg)'; initOrigin = 'center bottom'; }
          else if (eff === 'wipe') initClip = 'inset(0 100% 0 0)';
          else if (eff === 'wipe-up') initClip = 'inset(100% 0 0 0)';
          else initTransform = type === 'rise' ? 'translateX(-28px)' : 'translateY(28px)';

          if (initTransform) word.style.transform = initTransform;
          if (initClip) word.style.clipPath = initClip;
          if (initOrigin) word.style.transformOrigin = initOrigin;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (token !== runToken || !block.classList.contains('active')) return;
              word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.2,0.64,1), clip-path ' + dur + 'ms ease';
              word.style.opacity = '1';
              word.style.transform = 'none';
              word.style.clipPath = '';
              word.classList.add('in');

              if (impCls === 'imp-flicker') {
                schedule(() => {
                  if (token === runToken && block.classList.contains('active')) word.classList.add('fx');
                }, dur + 50);
              }
              if (impCls === 'imp-underline') {
                schedule(() => {
                  if (token === runToken && block.classList.contains('active')) word.classList.add('in');
                }, 50);
              }
            });
          });
          return;
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (token !== runToken || !block.classList.contains('active')) return;
            word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.2,0.64,1)';
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.classList.add('in');
          });
        });
      }, delay);
    });
  }

  function animateKaraoke(block) {
    const token = runToken;
    const words = block.querySelectorAll('.kf-word');
    const perWord = Math.round(HOLD / (words.length + 0.5));
    words.forEach((word) => {
      const fill = word.querySelector('.kf-fill');
      if (!fill) return;
      fill.style.transition = 'none';
      fill.style.clipPath = 'inset(0 100% 0 0)';
    });
    words.forEach((word, index) => {
      schedule(() => {
        if (token !== runToken || !block.classList.contains('active')) return;
        const fill = word.querySelector('.kf-fill');
        if (!fill) return;
        fill.style.transition = 'none';
        fill.style.clipPath = 'inset(0 100% 0 0)';
        void fill.offsetWidth;
        fill.style.transition = 'clip-path ' + perWord + 'ms linear';
        fill.style.clipPath = 'inset(0 0% 0 0)';
      }, index * perWord);
    });
  }

  function enterBlock(blocks, index, label) {
    const block = blocks[index];
    if (!block) return;
    activeBlockIndex = index;
    enforceSingleBlock(blocks, index);
    block.style.transition = 'none';
    block.style.opacity = '0';
    block.style.visibility = 'visible';
    block.style.zIndex = '2';
    resetWords(block);
    void block.offsetHeight;

    if (KEYFRAME_TEMPLATE) {
      block.classList.remove('active');
      block.style.opacity = '1';
      void block.offsetHeight;
      block.classList.add('active');
      if (label) label.textContent = block.dataset.label || '';
      return;
    }

    const isPlain = block.dataset.type === 'plain';
    const isWBW = block.dataset.type === 'wbw-rise'
      || block.dataset.type === 'wbw-slide'
      || block.dataset.type === 'wbw-seq'
      || block.dataset.type === 'wbw-seq-flip'
      || block.dataset.type === 'wbw-seq-fade';
    const isKaraoke = block.dataset.type === 'karaoke';

    if (isPlain) {
      block.style.transition = 'none';
      block.style.opacity = '1';
      block.classList.add('active');
    } else if (isKaraoke) {
      block.style.transition = 'none';
      block.style.opacity = '1';
      block.classList.add('active');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          animateKaraoke(block);
        });
      });
    } else if (isWBW) {
      block.style.transition = 'none';
      block.style.opacity = '1';
      block.classList.add('active');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          animateWordsIn(block);
        });
      });
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          block.style.transition = 'opacity ' + ENTER + 'ms ease';
          block.style.opacity = '1';
          block.classList.add('active');
        });
      });
    }

    if (label) {
      label.textContent = block.dataset.label || '';
    }
  }

  function exitBlock(block, callback) {
    if (block.dataset.type === 'plain') {
      block.style.transition = 'none';
      block.style.opacity = '0';
      block.classList.remove('active');
      resetWords(block);
      schedule(callback, GAP);
      return;
    }

    block.style.transition = 'opacity ' + EXIT + 'ms ease';
    block.style.opacity = '0';
    schedule(() => {
      block.classList.remove('active');
      block.style.visibility = 'hidden';
      block.style.zIndex = '0';
      resetWords(block);
      schedule(callback, GAP);
    }, EXIT);
  }

  function updateDots(dotsEl, idx) {
    dotsEl.querySelectorAll('.dot').forEach((dot, dotIndex) => {
      dot.classList.toggle('active', dotIndex === idx);
    });
  }

  function jumpTo(index) {
    if (!blocks[index]) return;
    if (LOCK_TO_PHASE) {
      runSequencer(blocks, dotsEl, labelEl, INITIAL_BLOCK_INDEX);
      return;
    }
    runSequencer(blocks, dotsEl, labelEl, index);
  }

  function runSequencer(blocks, dotsEl, labelEl, startIndex = 0) {
    clearPendingTimers();
    runToken += 1;
    let current = Math.max(0, Math.min(blocks.length - 1, startIndex));
    const token = runToken;

    enterBlock(blocks, current, labelEl);
    updateDots(dotsEl, current);
    if (LOCK_TO_PHASE) {
      schedule(() => {
        if (token === runToken) enforceSingleBlock(blocks, activeBlockIndex);
      }, 250);
      return;
    }

    function showNext() {
      if (token !== runToken) return;
      const prev = (current - 1 + blocks.length) % blocks.length;
      exitBlock(blocks[prev], () => {
        if (token !== runToken) return;
        enterBlock(blocks, current, labelEl);
        updateDots(dotsEl, current);
        current = (current + 1) % blocks.length;
        schedule(showNext, HOLD);
      });
    }

    current = (current + 1) % blocks.length;
    schedule(showNext, HOLD);
    schedule(() => {
      if (token === runToken) enforceSingleBlock(blocks, activeBlockIndex);
    }, 250);
  }

  const blocks = PREVIEW.blocks.map((item) => {
    const el = document.getElementById(item.id);
    if (!el) return null;
    el.dataset.type = item.type;
    el.dataset.label = item.label;
    if (PREVIEW.templateId === 't21' && item.id === 't21-b0') {
      // Recreate the five-word authored Fashion Editorial opener before
      // the live preview text is injected word-for-word.
      el.innerHTML = '<span class="editorial-line wbw-rise" data-text="SILENCE IS THE NEW LUXURY"><span class="w" data-i="0" style="--wbw-delay:0ms">SILENCE</span> <span class="w" data-i="1" style="--wbw-delay:65ms">IS</span> <span class="w" data-i="2" style="--wbw-delay:130ms">THE</span> <span class="w" data-i="3" style="--wbw-delay:195ms">NEW</span> <span class="w" data-i="4" style="--wbw-delay:260ms">LUXURY</span></span>';
    }
    if (PREVIEW.templateId === 't33' && item.id === 't33-b2' && item.type === 'karaoke' && !el.querySelector('.kf-line')) {
      el.textContent = '';
      const line = document.createElement('div');
      line.className = 'kf-line';
      'This is what we found'.split(/\s+/).forEach((word, index) => {
        if (index > 0) line.appendChild(document.createTextNode(' '));
        const wrapper = document.createElement('span');
        wrapper.className = 'kf-word';
        const base = document.createElement('span');
        base.className = 'kf-base';
        base.textContent = word;
        const fill = document.createElement('span');
        fill.className = 'kf-fill';
        fill.textContent = word;
        wrapper.append(base, fill);
        line.appendChild(wrapper);
      });
      el.appendChild(line);
    }
    el.classList.remove('active');
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.zIndex = '0';
    el.querySelectorAll('.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-flip, .wbw-seq-fade').forEach((wbwEl) => buildWBW(wbwEl));
    return el;
  }).filter(Boolean);
  injectAppliedPreviewCaption(blocks);
  const dotsEl = document.getElementById('dots-' + PREVIEW.templateId);
  const labelEl = document.getElementById(PREVIEW.templateId + '-label');

  if (PREVIEW.templateId === 't17') {
    const t17b1 = document.getElementById('t17-b1');
    if (t17b1) t17b1.dataset.type = 'styled';
  }

  if (blocks.length && dotsEl) {
    applyStillFramesPreviewHighlight(blocks);
    if (!dotsEl.dataset.dotHandlersBound) {
      dotsEl.dataset.dotHandlersBound = 'true';
      dotsEl.querySelectorAll('.dot').forEach((dot, dotIndex) => {
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
    }
    window.addEventListener('message', (event) => {
      const payload = event?.data || {};
      if (payload.type !== 'lekha-template-preview-jump') return;
      const nextIndex = Number(payload.index);
      if (!Number.isFinite(nextIndex)) return;
      jumpTo(nextIndex);
    });
    runSequencer(blocks, dotsEl, labelEl, INITIAL_BLOCK_INDEX);
    setInterval(() => enforceSingleBlock(blocks, activeBlockIndex), 250);
    window.addEventListener('pageshow', () => runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex));
    window.addEventListener('focus', () => runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex);
    });
  }

  if (PREVIEW.templateId === 't11') {
    const t11b0 = document.getElementById('t11-b0');
    if (t11b0) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
          const isActive = t11b0.classList.contains('active');
          const topRow = t11b0.querySelector('.cluster-row-top');
          const hl = t11b0.querySelector('.cluster-hl');
          const botRow = t11b0.querySelector('.cluster-row-bot');
          if (!topRow || !hl || !botRow) return;

          if (!isActive) {
            topRow.classList.remove('active');
            hl.classList.remove('active');
            botRow.classList.remove('active');
            return;
          }

          topRow.classList.remove('active');
          topRow.style.transition = 'none';
          hl.classList.remove('active');
          hl.style.transition = 'none';
          botRow.classList.remove('active');
          botRow.style.transition = 'none';
          void t11b0.offsetHeight;
          setTimeout(() => {
            topRow.style.transition = '';
            topRow.classList.add('active');
            setTimeout(() => {
              hl.style.transition = '';
              hl.classList.add('active');
              setTimeout(() => {
                botRow.style.transition = '';
                botRow.classList.add('active');
              }, 180);
            }, 220);
          }, 20);
        });
      });
      observer.observe(t11b0, { attributes: true });
    }
  }
})();
