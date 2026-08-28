(() => {
  const card = document.querySelector('.tcard, .btcard');
  if (!card) return;

  const advanced = card.classList.contains('tcard');
  const blocks = Array.from(card.querySelectorAll(advanced ? '.sblock' : '.bt-cap-block'));
  const dots = Array.from(card.querySelectorAll(advanced ? '.prog-dots .dot' : '.bt-prog-dots .dot'));
  const label = advanced ? card.querySelector('.stage-type-label') : null;
  if (!blocks.length) return;

  document.documentElement.classList.add('template-preview-script-ready');

  let activeIndex = 0;
  const show = (requestedIndex) => {
    activeIndex = ((requestedIndex % blocks.length) + blocks.length) % blocks.length;

    blocks.forEach((block, index) => {
      const active = index === activeIndex;
      block.classList.toggle('active', active);
      block.classList.toggle('is-active', active);
      block.style.display = advanced || active ? 'flex' : 'none';
      block.style.visibility = active ? 'visible' : 'hidden';
      block.style.opacity = active ? '1' : '0';
      block.style.zIndex = active ? '2' : '0';
      block.querySelectorAll('.w').forEach((word) => {
        word.classList.toggle('active', active);
        word.classList.toggle('in', active);
        word.style.opacity = active ? '1' : '0';
        word.style.transform = 'none';
        word.style.clipPath = 'none';
      });
      block.querySelectorAll('.kf-fill').forEach((fill) => {
        fill.style.clipPath = active ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)';
      });
    });

    dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
    if (label) label.textContent = blocks[activeIndex].dataset.label || label.textContent;
  };

  dots.forEach((dot, index) => {
    dot.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      show(index);
    });
  });

  window.addEventListener('message', (event) => {
    const payload = event?.data || {};
    if (payload.type !== 'lekha-template-preview-jump') return;
    const index = Number(payload.index);
    if (Number.isFinite(index)) show(index);
  });

  show(0);
  window.setInterval(() => show(activeIndex + 1), 2600);
})();
