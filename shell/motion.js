(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('motion-ready');

  const isSave = Boolean(navigator.connection?.saveData || window.matchMedia?.('(prefers-reduced-data: reduce)').matches);

  function noRev(el) {
    return !el || el.nodeType !== 1 || el.matches('[hidden],[hidden] *,h1,h1 *,video,video *,svg,svg *') || Boolean(el.closest('.chapter,#stage,#pins,#window,#train,#scrim,#arrive,#postcard,.route,#route,.pinned-scene,header,.compass-capsule,#night,.night,[data-reveal="none"]'));
  }

  function isRendered(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches('[hidden],[hidden] *,[aria-hidden="true"],[aria-hidden="true"] *,[inert],[inert] *')) return false;
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;
    try {
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
    } catch (_) {}
    return true;
  }

  function getCandidates() {
    const set = new Set();
    const isDest = Boolean(document.body?.classList.contains('dest'));

    function add(sel, kind = '') {
      document.querySelectorAll(sel).forEach(el => {
        if (!noRev(el) && isRendered(el)) {
          if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', kind);
          set.add(el);
        }
      });
    }

    add('h2', isDest ? 'clip' : '');
    add('p.lead,.lead,p.hook,p.jny-hero-sub,p.d-lead');
    add('.jny-card,.jny-stop-card,.frosted-card,.d-card,.d-act-btn,.d-hl-row,.d-office-card,.bureau-card,.office-block,.offices li,.exp-tile,.exp-card,.notebook-pick');
    add('details.faq-item,#faq details,.faq-section details,.spread-faq details', 'slide');
    add('.chips,.d-chips,.exp-filter-chip,.inquiry-form,.partner-form,fieldset,.form-group,[class*="ticket"],.pass-block');
    add('figure,.taped,.photo-card,.d-photo-block,img.hero-cover,.jny-gallery-item', 'photo');
    add('.footer-top-row,.footer-offices-strip,.footer-wordmark-wrap,.footer-bottom-row,.footer-legal-row');
    document.querySelectorAll('[data-reveal]').forEach(el => {
      if (!noRev(el) && isRendered(el) && el.getAttribute('data-reveal') !== 'none') set.add(el);
    });

    return Array.from(set);
  }

  function initReveal() {
    const list = getCandidates();
    if (!list.length) return;

    const pm = new Map();
    list.forEach(el => {
      const p = el.parentElement;
      if (p) {
        if (!pm.has(p)) pm.set(p, []);
        pm.get(p).push(el);
      }
    });
    pm.forEach(k => {
      if (k.length > 1) k.forEach((c, i) => c.style.setProperty('--reveal-i', String(Math.min(i, 6))));
    });

    if (!('IntersectionObserver' in window)) {
      list.forEach(el => el.setAttribute('data-revealed', ''));
      return;
    }

    let q = [], tid = null;
    function flush() {
      const batch = q.slice();
      q = [];
      tid = null;
      batch.forEach((el, idx) => {
        const d = Math.min(idx, 12) * 40;
        if (d > 0) el.style.setProperty('--reveal-stagger-delay', d + 'ms');
        el.style.willChange = 'transform, opacity';
        el.setAttribute('data-revealed', '');
        const off = () => {
          el.style.removeProperty('will-change');
          el.removeEventListener('transitionend', off);
        };
        el.addEventListener('transitionend', off, { once: true });
        setTimeout(off, d + 1200);
      });
    }

    const io = new IntersectionObserver((es, obs) => {
      es.forEach(e => {
        if (e.isIntersecting || (e.boundingClientRect && e.boundingClientRect.top < (window.innerHeight || 800))) {
          obs.unobserve(e.target);
          q.push(e.target);
          if (!tid) tid = setTimeout(flush, 20);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    list.forEach(el => io.observe(el));

    if ('MutationObserver' in window) {
      const dynContainer = document.querySelector('#q-main, .planner-wrap, main') || document.body;
      if (dynContainer) {
        const mo = new MutationObserver(() => {
          const isDest = Boolean(document.body?.classList.contains('dest'));
          function checkAdd(sel, kind = '') {
            dynContainer.querySelectorAll(sel).forEach(el => {
              if (!noRev(el) && isRendered(el) && !el.hasAttribute('data-reveal') && !el.hasAttribute('data-revealed')) {
                el.setAttribute('data-reveal', kind);
                io.observe(el);
              }
            });
          }
          checkAdd('h2', isDest ? 'clip' : '');
          checkAdd('p.lead,.lead,p.hook,p.jny-hero-sub,p.d-lead');
          checkAdd('.jny-card,.jny-stop-card,.frosted-card,.d-card,.d-act-btn,.d-hl-row,.d-office-card,.bureau-card,.office-block,.offices li,.exp-tile,.exp-card,.notebook-pick');
          checkAdd('details.faq-item,#faq details,.faq-section details,.spread-faq details', 'slide');
          checkAdd('.chips,.d-chips,.exp-filter-chip,.inquiry-form,.partner-form,fieldset,.form-group,[class*="ticket"],.pass-block');
          checkAdd('figure,.taped,.photo-card,.d-photo-block,img.hero-cover,.jny-gallery-item', 'photo');
        });
        mo.observe(dynContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden', 'class', 'style', 'aria-hidden']
        });
      }
    }

    function checkEnd() {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const innerH = window.innerHeight || document.documentElement.clientHeight || 800;
      const scrollPos = scrollY + innerH;
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      if (scrollPos >= docHeight - 120 || document.documentElement.classList.contains('at-end') || document.body.classList.contains('at-end')) {
        document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach(el => {
          io.unobserve(el);
          el.setAttribute('data-revealed', '');
        });
      }
    }
    window.addEventListener('scroll', checkEnd, { passive: true });
    document.addEventListener('scroll', checkEnd, { passive: true });
    window.addEventListener('resize', checkEnd, { passive: true });
    checkEnd();
  }

  function initGlow() {
    if (isSave || document.body?.classList.contains('dest')) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;

    document.querySelectorAll('.jny-card,.frosted-card,.exp-tile,.office-block,.bureau-card').forEach(card => {
      let rId = 0;
      card.addEventListener('pointermove', e => {
        if (rId) return;
        rId = requestAnimationFrame(() => {
          rId = 0;
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
          card.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
        });
      }, { passive: true });
    });
  }

  function initScroll() {
    if (window.lenis || document.querySelector('.lenis')) return;
    document.addEventListener('click', e => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
      const h = a.getAttribute('href');
      if (!h || h === '#' || h.startsWith('#!')) return;
      try {
        const t = document.querySelector(h);
        if (t) {
          e.preventDefault();
          t.scrollIntoView({ behavior: 'smooth' });
          history.pushState?.(null, '', h);
        }
      } catch (_) {}
    });
  }

  function start() {
    initReveal();
    initGlow();
    initScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
