/**
 * ROTW Travels · Reveal Footer Animation (footer-reveal.js)
 * - Spec: spec-footer-fix-home
 * - Invisible at every scroll position except the very end (html.at-end, data-footer="on")
 * - Home page: normal in-flow block, no curtain reveal, entrance animation on scroll into view
 * - Other pages: curtain reveal on desktop/tablet (>=768px width, >=560px height)
 * - Giant wordmark & rotating compass needle
 * - Marquee and floating cards only active when footer is on
 * - Complete prefers-reduced-motion fallback
 */

(function () {
  'use strict';

  // Mark JS active immediately
  document.documentElement.classList.add('js');

  function initFooter() {
    const footer = document.querySelector('footer.rotw-shell-footer');
    if (!footer || footer.__rotwFooterInit) return;
    footer.__rotwFooterInit = true;

    const pageWrap = document.querySelector('.page-wrap');
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Detect home page: never use curtain reveal on index.html
    const isHome = document.body.classList.contains('page-home') ||
                   !!document.getElementById('story') ||
                   !!document.getElementById('stage') ||
                   window.location.pathname === '/' ||
                   (window.location.pathname.endsWith('/index.html') && !window.location.pathname.includes('/destinations/'));

    if (isHome) {
      document.body.classList.remove('has-curtain');
      document.body.classList.add('page-home');
    } else {
      document.body.classList.add('has-curtain');
    }

    // Check screen dimensions for curtain reveal capability (never on home page)
    function checkCurtainSupport() {
      if (isHome) return false;
      return window.innerWidth >= 768 && window.innerHeight >= 560;
    }

    if (checkCurtainSupport()) {
      document.documentElement.classList.add('curtain-ready');
    } else {
      document.documentElement.classList.remove('curtain-ready');
    }

    /* -------------------------------------------------------------
     * 1. SENTINEL & AT-END DETECTION (spec-footer-fix-home requirement 1)
     * ------------------------------------------------------------- */
    let sentinel = document.getElementById('rotw-footer-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'rotw-footer-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:relative;width:100%;height:1px;pointer-events:none;visibility:hidden;margin:0;padding:0;';
      footer.parentNode.insertBefore(sentinel, footer);
    }

    function updateAtEnd() {
      let isAtEnd = false;
      if (sentinel) {
        const rect = sentinel.getBoundingClientRect();
        isAtEnd = rect.top <= (window.innerHeight + 8);
      } else {
        const footerH = footer.offsetHeight || (window.innerHeight >= 560 ? Math.min(window.innerHeight, 760) : 560);
        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const innerH = window.innerHeight;
        const scrollH = document.documentElement.scrollHeight;
        const threshold = isHome ? (scrollH - footerH - 8) : (scrollH - 8);
        isAtEnd = (scrollY + innerH) >= threshold;
      }

      if (isAtEnd) {
        document.documentElement.classList.add('at-end');
        document.documentElement.setAttribute('data-footer', 'on');
      } else {
        document.documentElement.classList.remove('at-end');
        document.documentElement.removeAttribute('data-footer');
      }
      return isAtEnd;
    }

    window.addEventListener('scroll', updateAtEnd, { passive: true });
    if (window.lenis && typeof window.lenis.on === 'function') {
      try {
        window.lenis.on('scroll', updateAtEnd);
      } catch (_) {}
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(() => {
        updateAtEnd();
      }, {
        root: null,
        rootMargin: '0px 0px 8px 0px',
        threshold: 0
      });
      observer.observe(sentinel);
    }

    window.addEventListener('resize', () => {
      if (checkCurtainSupport()) {
        document.documentElement.classList.add('curtain-ready');
      } else {
        document.documentElement.classList.remove('curtain-ready');
      }
      updateAtEnd();
      if (window.ScrollTrigger) {
        ScrollTrigger.refresh();
      }
    });

    // Initial check
    updateAtEnd();

    /* -------------------------------------------------------------
     * 2. FLOATING CARDS DRAG & BOUNDS
     * ------------------------------------------------------------- */
    const floatCards = footer.querySelectorAll('.footer-float-card');
    const boundsZone = footer.querySelector('.footer-floats-bounds');

    if (!isReduced && floatCards.length > 0) {
      if (window.Draggable && typeof window.Draggable.create === 'function') {
        floatCards.forEach(card => {
          Draggable.create(card, {
            type: 'x,y',
            bounds: boundsZone || footer,
            edgeResistance: 0.85,
            cursor: 'grab',
            activeCursor: 'grabbing',
            onPress: function (e) {
              if (!document.documentElement.classList.contains('at-end')) {
                this.endDrag(e);
              }
            }
          });
        });
      } else {
        // Pointer events lightweight drag fallback
        floatCards.forEach(card => {
          let startX = 0, startY = 0, initialX = 0, initialY = 0, isDragging = false;

          card.addEventListener('pointerdown', (e) => {
            if (!document.documentElement.classList.contains('at-end')) return;
            if (e.target.tagName.toLowerCase() === 'a') return; // allow clicking mailto
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
    }

    /* -------------------------------------------------------------
     * 3. GSAP SCROLLTRIGGER REVEAL ANIMATION
     * ------------------------------------------------------------- */
    if (typeof window.gsap === 'undefined') return;

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      // Lenis synchronization if present
      if (window.lenis && typeof window.lenis.on === 'function') {
        try {
          window.lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(t => window.lenis.raf(t * 1000));
          gsap.ticker.lagSmoothing(0);
        } catch (_) {}
      }
    }

    const needle = footer.querySelector('.fw-needle');
    const letters = footer.querySelectorAll('.fw-letters > g, .fw-l');
    const statementLines = footer.querySelectorAll('.footer-statement .statement-line');
    const navItems = footer.querySelectorAll('.footer-nav-link, .footer-office-col');
    const blobs = footer.querySelector('.footer-blobs');

    // Pivot setup for giant wordmark needle
    let originStr = '226.55 135.85';
    if (needle) {
      gsap.set(needle, { svgOrigin: originStr });
    }

    const mm = gsap.matchMedia();

    // REDUCED MOTION: Instant final visible state, zero motion
    mm.add('(prefers-reduced-motion: reduce)', () => {
      if (blobs) gsap.set(blobs, { opacity: 1 });
      if (statementLines.length) gsap.set(statementLines, { y: 0, opacity: 1 });
      if (navItems.length) gsap.set(navItems, { y: 0, opacity: 1 });
      if (letters.length) gsap.set(letters, { yPercent: 0, rotation: 0, opacity: 1 });
      if (needle) gsap.set(needle, { rotation: 0 });
    });

    // NORMAL MOTION: Entrance / Reveal timeline
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!window.ScrollTrigger) return;

      // Initial resting state before entering footer
      if (blobs) gsap.set(blobs, { opacity: 0.55 });
      if (statementLines.length) gsap.set(statementLines, { y: 24, opacity: 0 });
      if (navItems.length) gsap.set(navItems, { y: 16, opacity: 0 });
      if (letters.length) gsap.set(letters, { yPercent: 60, rotation: 6, opacity: 0, transformOrigin: '50% 100%' });
      if (needle) gsap.set(needle, { rotation: -540, svgOrigin: originStr });

      if (isHome) {
        // Home page: entrance animation plays when footer scrolls into view (not scrubbed)
        const homeTl = gsap.timeline({
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
          homeTl.to(blobs, { opacity: 1, ease: 'power2.out', duration: 0.8 }, 0);
        }
        if (statementLines.length) {
          homeTl.to(statementLines, {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            ease: 'power2.out',
            duration: 0.8
          }, 0.1);
        }
        if (navItems.length) {
          homeTl.to(navItems, {
            y: 0,
            opacity: 1,
            stagger: 0.04,
            ease: 'power2.out',
            duration: 0.6
          }, 0.2);
        }
        if (letters.length) {
          homeTl.to(letters, {
            yPercent: 0,
            rotation: 0,
            opacity: 1,
            stagger: 0.06,
            ease: 'elastic.out(1, 0.7)',
            duration: 1
          }, 0.25);
        }
        if (needle) {
          homeTl.to(needle, {
            rotation: 0,
            svgOrigin: originStr,
            ease: 'power2.out',
            duration: 0.9
          }, 0.15);
        }
      } else {
        // Curtain pages (plan, reviews, notebook, destinations): scrubbed timeline
        const triggerTarget = pageWrap || footer;
        const isCurtain = checkCurtainSupport() && !!pageWrap;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: triggerTarget,
            start: isCurtain ? () => 'bottom ' + window.innerHeight : 'top 95%',
            end: isCurtain ? () => 'bottom bottom' : 'bottom bottom',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              // Once revealed (>95% progress), needle keeps following scroll as clock hand
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
          tl.to(blobs, { opacity: 1, ease: 'none', duration: 1 }, 0);
        }
        if (statementLines.length) {
          tl.to(statementLines, {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            ease: 'power2.out',
            duration: 0.8
          }, 0.1);
        }
        if (navItems.length) {
          tl.to(navItems, {
            y: 0,
            opacity: 1,
            stagger: 0.04,
            ease: 'power2.out',
            duration: 0.6
          }, 0.2);
        }
        if (letters.length) {
          tl.to(letters, {
            yPercent: 0,
            rotation: 0,
            opacity: 1,
            stagger: 0.06,
            ease: 'elastic.out(1, 0.7)',
            duration: 1
          }, 0.25);
        }
        if (needle) {
          tl.to(needle, {
            rotation: 0,
            svgOrigin: originStr,
            ease: 'power2.out',
            duration: 0.9
          }, 0.15);
        }
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
