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

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);

    // Fallback for throttled IO (hidden/background tab): reveal cards that are
    // already laid out within the expanded viewport. Layout boxes are computed
    // even when the tab is not painting, so this is reliable.
    const timer = setTimeout(() => {
      if (done) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      const vw = window.innerWidth || 0;
      // Require real layout size: a display:none card (e.g. the lg:hidden mobile
      // dock copy on desktop) reports an all-zero rect, which must NOT count as
      // "in view" — otherwise the hidden gallery mounts every iframe.
      const hasSize = rect.width > 0 && rect.height > 0;
      const inView = hasSize
        && rect.top < vh + 200 && rect.bottom > -200
        && rect.left < vw + 200 && rect.right > -200;
      if (inView) {
        reveal();
        observer.disconnect();
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [visible, rootMargin]);

  return [ref, visible];
}
