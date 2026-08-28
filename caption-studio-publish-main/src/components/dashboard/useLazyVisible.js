import { useEffect, useRef, useState } from 'react';

/**
 * Returns `[ref, visible]`. `visible` flips to true once the referenced element
 * scrolls into view (IntersectionObserver) and stays true thereafter.
 *
 * Used to lazy-mount heavy preview <iframe>s in the template galleries: each
 * gallery renders dozens of script-running srcdoc iframes, and the gallery is
 * mounted more than once (desktop panel + the lg:hidden MobileDashboardDock),
 * so eagerly mounting every iframe spun up well over a hundred live animating
 * frames at once. Offscreen / display:none cards never intersect, so they cost
 * nothing until actually seen.
 *
 * A getBoundingClientRect timeout fallback covers environments where the
 * IntersectionObserver callback is throttled (e.g. a backgrounded/hidden tab):
 * cards already within the expanded viewport are revealed even if IO never
 * fires, while genuinely offscreen cards remain deferred until IO catches up.
 */
export function useLazyVisible(rootMargin = '150px') {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    // The galleries scroll inside the inspector panel rather than the window.
    // Use that element as the observer root so cards reveal as the panel is
    // scrolled. A viewport-rooted observer can miss nested-scroll updates in
    // some Chromium/WebView versions and leave the iframe permanently blank.
    const findScrollParent = (element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
        if (/(auto|scroll|overlay)/.test(overflow)) return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const root = findScrollParent(node);
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
    };

    const isInView = () => {
      const rect = node.getBoundingClientRect();
      const bounds = root?.getBoundingClientRect();
      const top = bounds?.top ?? 0;
      const bottom = bounds?.bottom ?? (window.innerHeight || 0);
      const left = bounds?.left ?? 0;
      const right = bounds?.right ?? (window.innerWidth || 0);
      const hasSize = rect.width > 0 && rect.height > 0;
      return hasSize
        && rect.top < bottom + 200 && rect.bottom > top - 200
        && rect.left < right + 200 && rect.right > left - 200;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { root, rootMargin },
    );
    observer.observe(node);

    // Older embedded Chromium builds occasionally do not deliver an
    // IntersectionObserver callback for a nested overflow container. Keep a
    // lightweight event fallback so scrolling the gallery always materializes
    // the card that just entered the viewport.
    const checkVisibility = () => {
      if (!done && isInView()) {
        reveal();
        observer.disconnect();
      }
    };
    root?.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });

    // Fallback for throttled IO (hidden/background tab): reveal cards that are
    // already laid out within the expanded viewport. Layout boxes are computed
    // even when the tab is not painting, so this is reliable.
    const timer = setTimeout(() => {
      if (done) return;
      checkVisibility();
    }, 1000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      root?.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [visible, rootMargin]);

  return [ref, visible];
}
