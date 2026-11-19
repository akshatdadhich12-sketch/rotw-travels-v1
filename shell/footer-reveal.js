/**
 * ROTW Travels · Reveal Footer Animation (footer-reveal.js)
 * - Spec: spec-footer-v5 (no more curtain; one simple, never-cropped footer on every page)
 * - Footer is a normal in-flow block at the end of every page:
 *   position: relative, z-index: 6, height: auto, overflow: visible, opaque #0B1626 background with sunset blobs.
 * - Entrance animation triggered via IntersectionObserver + position check when footer top enters viewport.
 * - Fully visible if JavaScript fails, or after 1.5s of being in view.
 * - Giant wordmark with continuous compass needle rotation.
 * - Full prefers-reduced-motion fallback with zero motion.
 */

(function () {
  'use strict';

  // Mark JS active immediately
  document.documentElement.classList.add('js');

  function initFooter() {
    const footer = document.querySelector('footer.rotw-shell-footer');
    if (!footer || footer.__rotwFooterInit) return;
    footer.__rotwFooterInit = true;

    // Clean up any legacy curtain classes if present
    document.body.classList.remove('has-curtain');
    document.documentElement.classList.remove('curtain-ready');

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* -------------------------------------------------------------
     * 1. AT-END & IN-VIEW DETECTION
     * ------------------------------------------------------------- */
    let inViewTimer = null;

    function forceFullVisibility() {
      document.documentElement.classList.add('at-end');
      document.documentElement.setAttribute('data-footer', 'on');
      footer.classList.add('footer-force-visible');

      // Ensure all animated sub-elements are fully visible
      const statementLines = footer.querySelectorAll('.footer-statement .statement-line');
      const navItems = footer.querySelectorAll('.footer-nav-link, .footer-office-col');
      const letters = footer.querySelectorAll('.fw-letters > g, .fw-l');
      const blobs = footer.querySelector('.footer-blobs');

      if (blobs) blobs.style.opacity = '1';
      statementLines.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
      navItems.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
      letters.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    }

    if (isReduced) {
      forceFullVisibility();
    }

    function startInViewSafetyTimer() {
      if (!inViewTimer) {
        inViewTimer = setTimeout(() => {
          forceFullVisibility();
        }, 1500);
      }
    }

    function updateAtEnd() {
      if (isReduced) return true;

      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const innerH = window.innerHeight;
      const scrollH = document.documentElement.scrollHeight;

      let isAtEnd = false;
      const fRect = footer.getBoundingClientRect();

      // Rule 1: Footer top has entered the viewport (or is above it)
      if (fRect.top <= (innerH + 8)) {
        isAtEnd = true;
      }

      // Rule 2: Bottom of page reached by any means (End key, dragging scrollbar, flick)
      if (scrollY + innerH >= (scrollH - 4)) {
        isAtEnd = true;
      }

      // Rule 3: Any part of footer is visible in the viewport
      if (fRect.top < innerH && fRect.bottom > 0) {
        isAtEnd = true;
      }

      if (isAtEnd) {
        document.documentElement.classList.add('at-end');
        document.documentElement.setAttribute('data-footer', 'on');
        footer.classList.add('footer-force-visible');
        startInViewSafetyTimer();
      } else {
        document.documentElement.classList.remove('at-end');
        document.documentElement.removeAttribute('data-footer');
        footer.classList.remove('footer-force-visible');
      }
      return isAtEnd;
    }

    let scrollRaf = null;
    function throttledUpdate() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        updateAtEnd();
      });
    }

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    if (window.lenis && typeof window.lenis.on === 'function') {
      try {
        window.lenis.on('scroll', throttledUpdate);
      } catch (_) {}
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            document.documentElement.classList.add('footer-in-view');
          } else {
            document.documentElement.classList.remove('footer-in-view');
          }
          if (entry.isIntersecting || entry.boundingClientRect.top <= window.innerHeight + 8) {
            updateAtEnd();
            startInViewSafetyTimer();
          }
        }
      }, {
        root: null,
        rootMargin: '0px 0px 8px 0px',
        threshold: 0
      });
      observer.observe(footer);
    }

    window.addEventListener('resize', () => {
      updateAtEnd();
      if (window.ScrollTrigger) {
        ScrollTrigger.refresh();
      }
    });

    window.addEventListener('orientationchange', () => {
      updateAtEnd();
      if (window.ScrollTrigger) {
        ScrollTrigger.refresh();
      }
    });

    window.addEventListener('load', () => {
      updateAtEnd();
      if (window.ScrollTrigger) {
        ScrollTrigger.refresh();
      }
    });

    setTimeout(updateAtEnd, 300);
    setTimeout(updateAtEnd, 1200);

    if (typeof ResizeObserver !== 'undefined' && document.body) {
      const ro = new ResizeObserver(() => {
        updateAtEnd();
      });
      ro.observe(document.body);
    }

    // Initial check
    updateAtEnd();

    /* -------------------------------------------------------------
     * 2. FLOATING CARDS DRAG & BOUNDS
     * ------------------------------------------------------------- */
    const floatCards = footer.querySelectorAll('.footer-float-card');
    const boundsZone = footer.querySelector('.footer-floats-bounds');

    if (!isReduced && floatCards.length > 0) {
      floatCards.forEach(card => {
        let startX = 0, startY = 0, initialX = 0, initialY = 0, isDragging = false;

        card.addEventListener('pointerdown', (e) => {
          if (!document.documentElement.classList.contains('at-end')) return;
          if (e.target.tagName.toLowerCase() === 'a') return;
          isDragging = true;
          card.setPointerCapture(e.pointerId);
          startX = e.clientX;
          startY = e.clientY;
          const matrix = window.getComputedStyle(card).transform;
          if (matrix !== 'none') {
            const values = matrix.split('(')[1].split(')')[0].split(',');
            initialX = parseFloat(values[4]) || 0;
            initialY = parseFloat(values[5]) || 0;
          } else {
            initialX = 0;
            initialY = 0;
          }
          card.style.cursor = 'grabbing';
        });

        card.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          card.style.transform = `translate(${initialX + dx}px, ${initialY + dy}px)`;
        });

        const endDrag = (e) => {
          if (!isDragging) return;
          isDragging = false;
          try { card.releasePointerCapture(e.pointerId); } catch (_) {}
          card.style.cursor = 'grab';
        };

        card.addEventListener('pointerup', endDrag);
        card.addEventListener('pointercancel', endDrag);
      });
    }

    /* -------------------------------------------------------------
     * 3. GSAP SCROLLTRIGGER ENTRANCE ANIMATION (Sitewide)
     * ------------------------------------------------------------- */
    if (typeof window.gsap === 'undefined') return;

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      if (window.lenis && typeof window.lenis.on === 'function') {
        try {
          window.lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(t => window.lenis.raf(t * 1000));
          gsap.ticker.lagSmoothing(0);
        } catch (_) {}
      }
    }

    const needle = footer.querySelector('.fw-needle, #fw-needle, .lgf-needle, #lgf-needle');
    const letters = footer.querySelectorAll('.fw-letters > g, .fw-l, #lgf-letters > g, .lgf-l');
    const statementLines = footer.querySelectorAll('.footer-statement .statement-line');
    const navItems = footer.querySelectorAll('.footer-nav-link, .footer-office-col');
    const blobs = footer.querySelector('.footer-blobs');

    const originStr = '226.55 135.85';
    if (needle) {
      gsap.set(needle, { svgOrigin: originStr });
    }

    const mm = gsap.matchMedia();

    // REDUCED MOTION: Instant visible state, zero motion
    mm.add('(prefers-reduced-motion: reduce)', () => {
      if (blobs) gsap.set(blobs, { opacity: 1 });
      if (statementLines.length) gsap.set(statementLines, { y: 0, opacity: 1 });
      if (navItems.length) gsap.set(navItems, { y: 0, opacity: 1 });
      if (letters.length) gsap.set(letters, { yPercent: 0, rotation: 0, opacity: 1 });
      if (needle) gsap.set(needle, { rotation: 0 });
    });

    // NORMAL MOTION: Entrance timeline played when footer enters view
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!window.ScrollTrigger) return;

      if (blobs) gsap.set(blobs, { opacity: 0.55 });
      if (statementLines.length) gsap.set(statementLines, { y: 24, opacity: 0 });
      if (navItems.length) gsap.set(navItems, { y: 16, opacity: 0 });
      if (letters.length) gsap.set(letters, { yPercent: 60, rotation: 6, opacity: 0, transformOrigin: '50% 100%' });
      if (needle) gsap.set(needle, { rotation: -540, svgOrigin: originStr });

      const entranceTl = gsap.timeline({
        scrollTrigger: {
          trigger: footer,
          start: 'top 95%',
          toggleActions: 'play none none reverse',
          onUpdate: (self) => {
            if (self.progress >= 0.95 && needle && document.documentElement.classList.contains('at-end')) {
              const scrollY = window.scrollY || window.pageYOffset || 0;
              gsap.to(needle, {
                rotation: scrollY * 0.30,
                svgOrigin: originStr,
                duration: 0.4,
                ease: 'power3.out',
                overwrite: 'auto'
              });
            }
          }
        }
      });

      if (blobs) {
        entranceTl.to(blobs, { opacity: 1, ease: 'power2.out', duration: 0.8 }, 0);
      }
      if (statementLines.length) {
        entranceTl.to(statementLines, {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          ease: 'power2.out',
          duration: 0.8
        }, 0.1);
      }
      if (navItems.length) {
        entranceTl.to(navItems, {
          y: 0,
          opacity: 1,
          stagger: 0.04,
          ease: 'power2.out',
          duration: 0.6
        }, 0.2);
      }
      if (letters.length) {
        entranceTl.to(letters, {
          yPercent: 0,
          rotation: 0,
          opacity: 1,
          stagger: 0.06,
          ease: 'elastic.out(1, 0.7)',
          duration: 1
        }, 0.25);
      }
      if (needle) {
        entranceTl.to(needle, {
          rotation: 0,
          svgOrigin: originStr,
          ease: 'power2.out',
          duration: 0.9
        }, 0.15);
      }

      // Continuous needle scroll follower when footer is active at end
      window.addEventListener('scroll', () => {
        if (document.documentElement.classList.contains('at-end') && needle) {
          const scrollY = window.scrollY || window.pageYOffset || 0;
          gsap.to(needle, {
            rotation: scrollY * 0.30,
            svgOrigin: originStr,
            duration: 0.4,
            ease: 'power3.out',
            overwrite: 'auto'
          });
        }
      }, { passive: true });
    });
  }

  window.initROTWFooter = initFooter;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFooter);
  } else {
    initFooter();
  }
})();
