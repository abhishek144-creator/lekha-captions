// Template-card preview sequencer. Runs inside the sandboxed srcdoc frame
// built by AdvancedTemplateLibrary.jsx buildBasicTemplatePreviewDoc(); per-template values arrive in the
// #lekha-preview-config JSON block. The production CSP allows this exact
// text by hash: after editing it, run `npm run release:contracts` and copy
// the hash it reports into vite.config.js, firebase.json and netlify.toml.
const PREVIEW = JSON.parse(document.getElementById('lekha-preview-config').textContent);
(() => {
  const card = document.querySelector('.btcard');
  if (!card) return;

  // Some source templates are organised as fixed caption lines rather than
  // word-indexed spans.  Cycle those lines directly so each preview phase
  // (including Quiet V3.2's sticky wave) is visible in the card.
  const fixedHighlightPerLine = ['t-106', 't-52', 't-T4', 't-WS1', 't-QW1'].includes(PREVIEW.templateId);
  const previewWordIndexForBlock = (blockIndex) => Math.min((Math.max(0, blockIndex) * 4) + 2, wordCount - 1);
  let idx = 2;
  let currentBlock = -1;
  const blocks = Array.from(card.querySelectorAll('.bt-cap-block'));
  const dots = Array.from(card.querySelectorAll('.bt-prog-dots .dot'));
  const wordCount = Math.max(1, card.querySelectorAll('.word[data-wi]').length);

  function cls(wi) {
    let className = 'word';
    if (wi <= idx) className += ' active';
    if (wi === idx) className += ' current';
    if (wi === idx && ['t-106', 't-52', 't-T4', 't-WS1', 't-QW1'].includes(PREVIEW.templateId)) className += ' imp';
    return className;
  }

  function activateWholeLine(blockIndex) {
    card.querySelectorAll('.word[data-wi]').forEach((word) => {
      if (word.closest('.cpt-wrap') || word.closest('.t-102') || word.closest('.t-103') || word.closest('.t-124')) return;
      if (Math.floor(Number(word.dataset.wi || 0) / 4) === blockIndex) {
        word.classList.add('active');
      }
    });
  }

  function triggerStickyWave(sblock) {
    const words = Array.from(sblock.querySelectorAll('.sw-w'));
    words.forEach((word) => {
      word.style.opacity = '0.42';
    });
    words.forEach((word, wordIndex) => {
      setTimeout(() => {
        word.style.opacity = '1';
      }, wordIndex * PREVIEW.timing.stickyWaveStaggerMs);
    });
  }

  function animateBlock(block) {
    const phaseIndex = Array.from(block.parentElement?.children || []).indexOf(block);
    block.querySelectorAll('.t-52 .word, .t-T4 .word, .t-106 .word, .t-T6 .word').forEach((word) => {
      word.style.opacity = '';
      word.style.transform = '';
      word.style.transition = '';
      word.style.animation = '';
    });

    block.querySelectorAll('.t-52, .t-T4, .t-106, .t-T6, .t-56').forEach((wrapper) => {
      wrapper.querySelectorAll('.word').forEach((word) => {
        word.classList.add('active');
      });
    });

    block.querySelectorAll('.t-52').forEach((wrapper) => {
      if (phaseIndex === 0) {
        wrapper.style.transition = 'none';
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'translateY(44px)';
        setTimeout(() => {
          wrapper.style.transition = 'transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease';
          wrapper.style.opacity = '1';
          wrapper.style.transform = 'none';
        }, 30);
        return;
      }
      wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
        word.style.transition = 'none';
        word.style.opacity = '0';
        word.style.transform = phaseIndex === 1 ? 'translateX(-38px)' : 'translateX(38px)';
        setTimeout(() => {
          word.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)';
          word.style.opacity = '1';
          word.style.transform = 'none';
        }, 30 + (wordIndex * PREVIEW.timing.wordStaggerMs));
      });
    });

    block.querySelectorAll('.t-T4').forEach((wrapper) => {
      wrapper.classList.remove('study-line-0', 'study-line-1', 'study-line-2', 'study-word-slide-preview');
      wrapper.style.transition = 'none';
      wrapper.style.animation = 'none';
      wrapper.style.opacity = phaseIndex === 1 ? '1' : '0';
      wrapper.style.transform = phaseIndex === 0
        ? 'translateX(-38px)'
        : phaseIndex === 2
          ? 'translateY(24px)'
          : 'none';
      wrapper.querySelectorAll('.cap-text, .basic-manual-line, .word').forEach((node) => {
        node.style.transition = '';
        node.style.animation = '';
        node.style.opacity = '';
        node.style.transform = '';
      });
      wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
        if (phaseIndex === 1) {
          word.style.setProperty('--ws-delay', (90 + (wordIndex * 55)) + 'ms');
        } else {
          word.style.removeProperty('--ws-delay');
        }
        word.style.removeProperty('--basic-word-delay');
      });
      void wrapper.offsetWidth;
      wrapper.classList.add('study-line-' + phaseIndex);
      wrapper.classList.toggle('study-word-slide-preview', phaseIndex === 1);
      if (phaseIndex === 0) {
        wrapper.style.animation = 'basicWordSlideFromLeft 0.42s cubic-bezier(0.22,1,0.36,1) both';
      } else if (phaseIndex === 2) {
        wrapper.style.animation = 'wordRiseInFromBottom 0.38s cubic-bezier(0.34,1.2,0.64,1) both';
      } else {
        wrapper.style.animation = 'none';
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'none';
      }
    });

    block.querySelectorAll('.t-106').forEach((wrapper) => {
      wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
        word.style.transition = 'none';
        word.style.opacity = phaseIndex === 1 ? '1' : '0';
        word.style.transform = phaseIndex === 0
          ? 'translateY(20px)'
          : phaseIndex === 2
            ? 'translateX(38px)'
            : 'none';
        if (phaseIndex === 1) {
          word.style.opacity = '1';
          word.style.transform = 'none';
          word.style.animation = 'none';
          return;
        }
        setTimeout(() => {
          word.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)';
          word.style.opacity = '1';
          word.style.transform = 'none';
        }, 30 + (wordIndex * PREVIEW.timing.wordStaggerMs));
      });
    });

    block.querySelectorAll('.t-T6 .word').forEach((word, wordIndex) => {
      word.style.transition = 'none';
      word.style.opacity = '0';
      word.style.transform = 'translateY(20px)';
      setTimeout(() => {
        word.style.transition = 'opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.2,0.64,1)';
        word.style.opacity = '1';
        word.style.transform = 'none';
      }, 30 + (wordIndex * PREVIEW.timing.wordStaggerMs));
      setTimeout(() => {
        word.style.opacity = '1';
        word.style.transform = 'none';
      }, 520);
    });

    block.querySelectorAll('.t-WS1').forEach((wrapper) => {
      wrapper.classList.remove('ws-enter', 'ws-done', 'ws-line-0', 'ws-line-1', 'ws-line-2');
      wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
        word.style.transition = 'none';
        word.style.animation = '';
        word.style.opacity = '';
        word.style.transform = '';
        word.style.filter = 'none';
        word.style.setProperty('--ws-delay', (120 + (wordIndex * PREVIEW.timing.wordStaggerMs)) + 'ms');
      });
      void wrapper.offsetWidth;
      wrapper.classList.add('ws-enter', 'ws-line-' + phaseIndex);
    });

    block.querySelectorAll('.sblock[data-type="sticky-wave"]').forEach(triggerStickyWave);
  }

  function setBlock(blockIndex) {
    const blockChanged = blockIndex !== currentBlock;
    currentBlock = blockIndex;
    blocks.forEach((block, index) => {
      const active = index === blockIndex;
      block.style.display = active ? 'flex' : 'none';
      block.classList.toggle('active', active);
      block.classList.toggle('is-active', active);
      if (active && blockChanged) animateBlock(block);
    });
    dots.forEach((dot, index) => {
      dot.className = 'dot' + (index === blockIndex ? ' active' : '');
    });
  }

  function tick() {
    if (fixedHighlightPerLine) {
      const nextBlockIndex = Math.max(0, (currentBlock + 1) % Math.max(1, blocks.length));
      idx = previewWordIndexForBlock(nextBlockIndex);
      card.querySelectorAll('.word[data-wi]').forEach((word) => {
        word.className = cls(Number(word.dataset.wi || 0));
      });
      setBlock(nextBlockIndex);
      activateWholeLine(nextBlockIndex);
      return;
    }
    idx = (idx + 1) % wordCount;
    card.querySelectorAll('.word[data-wi]').forEach((word) => {
      word.className = cls(Number(word.dataset.wi || 0));
    });
    const blockIndex = Math.max(0, Math.min(blocks.length - 1, Math.floor(idx / 4)));
    setBlock(blockIndex);
    activateWholeLine(blockIndex);
  }

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => {
      idx = previewWordIndexForBlock(dotIndex);
      card.querySelectorAll('.word[data-wi]').forEach((word) => {
        word.className = cls(Number(word.dataset.wi || 0));
      });
      setBlock(dotIndex);
      activateWholeLine(dotIndex);
    });
  });

  window.addEventListener('message', (event) => {
    const payload = event?.data || {};
    if (payload.type !== 'lekha-template-preview-jump') return;
    const dotIndex = Number(payload.index);
    if (!Number.isFinite(dotIndex) || !dots[dotIndex]) return;
    idx = previewWordIndexForBlock(dotIndex);
    card.querySelectorAll('.word[data-wi]').forEach((word) => {
      word.className = cls(Number(word.dataset.wi || 0));
    });
    setBlock(dotIndex);
    activateWholeLine(dotIndex);
  });

  idx = previewWordIndexForBlock(0);
  card.querySelectorAll('.word[data-wi]').forEach((word) => {
    word.className = cls(Number(word.dataset.wi || 0));
  });
  const cycleMs = fixedHighlightPerLine ? PREVIEW.timing.fixedLineCycleMs : PREVIEW.timing.wordCycleMs;
  setBlock(0);
  activateWholeLine(0);
  setInterval(tick, cycleMs);
})();
