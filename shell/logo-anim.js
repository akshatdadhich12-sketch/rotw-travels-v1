/**
 * ROTW Travels · Capsule Header Logo GSAP Animation
 * - The compass needle rotates like a clock hand inside the compass when the page scrolls.
 * - Compass face (#lg-face) remains fixed and never rotates.
 * - Needle (#lg-needle) is the only rotating part, looking like a clock hand with hub and red tip.
 * - Exact center computed from O's bounding box (pivoting at center in SVG user units).
 * - Continuous, uncapped scroll rotation: rotation = scrollY * 0.30 deg (clockwise down, anticlockwise up).
 * - Driven with gsap.quickTo(needle, 'rotation', { duration: 0.5, ease: 'power3' }) via rAF + Lenis.
 * - Clock feel: settling with tiny tick-back overshoot (elastic.out(1, 0.6) over 0.5s, max 4 deg) on scroll stop.
 * - Intro timeline (~1.6s once per visit) ends with needle at rotation matching current scroll position.
 * - Prefers-reduced-motion shows static state at 0deg with zero motion.
 * - Invariant capsule dimensions (980x52 desktop, 342x46 mobile).
 * - Safe fallback without errors if GSAP is absent.
 */

(function () {
  'use strict';

  function initROTWLogo() {
    if (typeof window === 'undefined' || !window.gsap) return;

    const logos = document.querySelectorAll('.rotw-logo');
    if (!logos.length) return;

    logos.forEach(logo => {
      if (logo.__rotwLogoInitialized) return;
      logo.__rotwLogoInitialized = true;
      initSingleLogo(logo);
    });
  }

  function initSingleLogo(logo) {
    const needle = logo.querySelector('#lg-needle, #lgf-needle, .lg-needle, .lgf-needle');
    const face = logo.querySelector('#lg-face, #lgf-face, .lg-face, .lgf-face');
    const letters = logo.querySelectorAll('#lg-letters > g, #lgf-letters > g, .lg-l, .lgf-l');
    const accents = logo.querySelectorAll('#lg-accent > *, #lgf-accent > *, .lg-red, .lg-plane');
    const tagline = logo.querySelector('#lg-tagline, #lgf-tagline, .lg-tagline, .lgf-tagline');
    const oLetter = logo.querySelector('#lg-l-o .lg-ring, #lgf-l-o .lg-ring') || logo.querySelector('#lg-l-o, #lgf-l-o');

    if (!needle) return;

    // 1. Compute exact center of the O from bounding box (SVG user units)
    let cx = 226.55;
    let cy = 135.85;

    if (oLetter && typeof oLetter.getBBox === 'function') {
      try {
        const bbox = oLetter.getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          cx = bbox.x + bbox.width / 2;
          cy = bbox.y + bbox.height / 2;
        }
      } catch (e) {}
    }

    const originStr = `${cx.toFixed(2)} ${cy.toFixed(2)}`;

    // Set needle pivot at exact center
    gsap.set(needle, {
      svgOrigin: originStr
    });

    if (face) {
      gsap.set(face, { clearProps: 'transform' });
    }

    const mm = gsap.matchMedia();

    // 2. Prefers-reduced-motion: static at 0 degrees, zero motion, no intro
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(needle, { rotation: 0, clearProps: 'transform' });
      if (face) gsap.set(face, { clearProps: 'transform' });
      gsap.set(letters, { y: 0, opacity: 1, clearProps: 'transform,opacity' });
      gsap.set(accents, { opacity: 1, clearProps: 'opacity' });
      if (tagline) gsap.set(tagline, { opacity: 1, clearProps: 'opacity' });
    });

    // 3. Normal motion: intro + continuous scroll rotation + clock tick-back overshoot
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      let seen = false;
      try {
        seen = sessionStorage.getItem('rotw-logo-intro') === '1';
      } catch (e) {}

      // Scroll-driven needle rotation with gsap.quickTo
      const setNeedleRotation = gsap.quickTo(needle, 'rotation', { duration: 0.5, ease: 'power3' });

      let lastScrollY = window.scrollY || window.pageYOffset || 0;
      let lastVelocity = 0;
      let rAFScheduled = false;
      let scrollStopTimer = null;
      let isIdle = false;

      function updateTargetRotation() {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const targetDeg = scrollY * 0.30;
        setNeedleRotation(targetDeg);
      }

      function onScrollStop() {
        if (!needle) return;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const targetDeg = scrollY * 0.30;
        if (Math.abs(lastVelocity) > 0.5) {
          // Tiny tick-back overshoot (at most 4 degrees, elastic.out(1, 0.6) over 0.5s)
          const nudge = Math.max(-4, Math.min(4, lastVelocity * 0.08));
          gsap.fromTo(needle,
            { svgOrigin: originStr, rotation: targetDeg + nudge },
            { svgOrigin: originStr, rotation: targetDeg, duration: 0.5, ease: 'elastic.out(1, 0.6)', overwrite: 'auto' }
          );
        }
        lastVelocity = 0;
      }

      function onScroll() {
        const currentY = window.scrollY || window.pageYOffset || 0;
        const dy = currentY - lastScrollY;
        if (Math.abs(dy) > 0.5) {
          lastVelocity = dy;
        }
        lastScrollY = currentY;

        if (!isIdle) return;

        if (!rAFScheduled) {
          rAFScheduled = true;
          window.requestAnimationFrame(() => {
            rAFScheduled = false;
            updateTargetRotation();
          });
        }

        if (scrollStopTimer) clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(onScrollStop, 120);
      }

      function enableIdle() {
        isIdle = true;
        window.addEventListener('scroll', onScroll, { passive: true });

        // Lenis integration
        if (window.lenis && typeof window.lenis.on === 'function') {
          try { window.lenis.on('scroll', onScroll); } catch (e) {}
        }
        if (!window.__rotwLenisBound) {
          window.__rotwLenisBound = true;
          let lenisRef = window.lenis;
          try {
            Object.defineProperty(window, 'lenis', {
              configurable: true,
              enumerable: true,
              get() { return lenisRef; },
              set(v) {
                lenisRef = v;
                if (v && typeof v.on === 'function') {
                  try { v.on('scroll', onScroll); } catch (e) {}
                }
              }
            });
          } catch (e) {}
          if (lenisRef && typeof lenisRef.on === 'function') {
            try { lenisRef.on('scroll', onScroll); } catch (e) {}
          }
        }

        // Sync immediately with current scroll
        updateTargetRotation();
      }

      if (seen) {
        // Intro already seen this session: set base rotation smoothly & enable idle
        const scrollY = window.scrollY || window.pageYOffset || 0;
        gsap.set(needle, { rotation: scrollY * 0.30 });
        enableIdle();
        return;
      }

      // Mark intro as seen in sessionStorage
      try {
        sessionStorage.setItem('rotw-logo-intro', '1');
      } catch (e) {}

      // Intro timeline ~1.6s ends with needle at rotation matching current scroll position
      const currentScroll = window.scrollY || window.pageYOffset || 0;
      const endRot = currentScroll * 0.30;

      const tl = gsap.timeline({
        onComplete: () => {
          const scrollY = window.scrollY || window.pageYOffset || 0;
          gsap.set(needle, { rotation: scrollY * 0.30 });
          enableIdle();
        }
      });
      window.__rotwLogoTl = tl;

      // 1. Letters rise with a 0.04s stagger (duration 0.6s)
      if (letters.length > 0) {
        tl.from(letters, {
          y: 12,
          opacity: 0,
          duration: 0.6,
          stagger: 0.04,
          ease: 'power3.out'
        }, 0);
      }

      // 2. Needle spins then settles on current scroll rotation (endRot) with elastic.out(1, 0.6)
      tl.fromTo(needle, {
        svgOrigin: originStr,
        rotation: endRot - 540
      }, {
        svgOrigin: originStr,
        rotation: endRot,
        duration: 1.35,
        ease: 'elastic.out(1, 0.6)'
      }, 0.15);

      // 3. Accent and tagline fade in last
      const fadeTargets = [];
      if (accents.length > 0) fadeTargets.push(...accents);
      if (tagline && tagline.children && tagline.children.length > 0) fadeTargets.push(tagline);
      if (fadeTargets.length > 0) {
        tl.from(fadeTargets, {
          opacity: 0,
          duration: 0.45,
          ease: 'power2.out'
        }, 1.15);
      }

      // Skip intro on any click or keypress
      let introSkipped = false;
      function skipIntro(e) {
        if (introSkipped) return;
        if (e && e.isTrusted === false) return;
        introSkipped = true;
        if (tl && tl.isActive()) {
          tl.progress(1);
        }
        cleanupSkip();
      }

      function cleanupSkip() {
        window.removeEventListener('click', skipIntro);
        window.removeEventListener('keydown', skipIntro);
      }

      window.addEventListener('click', skipIntro, { passive: true });
      window.addEventListener('keydown', skipIntro, { passive: true });
    });
  }

  function scheduleInit() {
    if (document.documentElement.classList.contains('splash-pending')) {
      let fired = false;
      function onDone() {
        if (fired) return;
        fired = true;
        window.removeEventListener('rotw-splash-done', onDone);
        initROTWLogo();
      }
      window.addEventListener('rotw-splash-done', onDone);
      setTimeout(onDone, 3600);
      return;
    }
    if (document.documentElement.classList.contains('transition-pending')) {
      let fired = false;
      function onDone() {
        if (fired) return;
        fired = true;
        window.removeEventListener('rotw-transition-done', onDone);
        initROTWLogo();
      }
      window.addEventListener('rotw-transition-done', onDone);
      setTimeout(onDone, 2600);
      return;
    }
    initROTWLogo();
  }

  window.initROTWLogoAnim = initROTWLogo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit);
  } else {
    scheduleInit();
  }
})();
