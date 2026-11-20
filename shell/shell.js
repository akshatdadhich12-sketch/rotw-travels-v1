/**
 * ROTW Travels · Shared Shell JavaScript
 * - Throttled compass needle rotation tracking scroll (fixed capsule, zero shrinkage)
 * - 3-Language switcher (en, ru, ar RTL) syncing to localStorage 'rotw-lang'
 * - Mobile menu overlay (<1024px) with focus trap & Esc handling
 * - Live timezone clocks (Moscow, Dubai, Mumbai, Muscat, Hong Kong) via Intl.DateTimeFormat
 * - Notebook envelope fade-out when footer is in view
 * - Global sasha-line event dispatcher
 */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ============================================================
     1. COMPASS CAPSULE LOGO & GSAP ANIMATION LOADER
     ============================================================ */
  (function initLogoLoader() {
    function start() {
      if (window.gsap && typeof window.initROTWLogoAnim === 'function') {
        window.initROTWLogoAnim();
      }
      if (typeof window.initROTWFooter === 'function') {
        window.initROTWFooter();
      }
      if (typeof window.initSashaChat === 'function') {
        window.initSashaChat();
      }
    }

    const relBase = (function() {
      const s = document.querySelector('script[src*="shell.js"]');
      if (s) {
        const src = s.getAttribute('src');
        const idx = src.indexOf('shell/shell.js');
        if (idx >= 0) return src.slice(0, idx);
      }
      return './';
    })();

    function loadScript(src, cb) {
      if (document.querySelector(`script[src="${src}"]`)) {
        if (cb) cb();
        return;
      }
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = cb;
      tag.onerror = function() {
        console.warn('Could not load script:', src);
      };
      document.head.appendChild(tag);
    }

    function loadShellScripts() {
      loadScript(relBase + 'shell/logo-anim.js', () => {
        loadScript(relBase + 'shell/footer-reveal.js', () => {
          loadScript(relBase + 'shell/sasha-chat.js', start);
        });
      });
    }

    if (window.gsap) {
      loadShellScripts();
    } else {
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', function() {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js', function() {
          loadShellScripts();
        });
      });
    }
  })();

  /* ============================================================
     2. LANGUAGE SWITCHER (rotw-lang)
     ============================================================ */
  const LANGS = ['en', 'ru', 'ar'];

  function getCurrentLang() {
    const stored = localStorage.getItem('rotw-lang');
    if (stored && LANGS.includes(stored)) return stored;
    const docLang = document.documentElement.getAttribute('lang') || 'en';
    return LANGS.includes(docLang) ? docLang : 'en';
  }

  function setLanguage(lang) {
    if (!LANGS.includes(lang)) return;
    localStorage.setItem('rotw-lang', lang);

    // Sync select dropdowns and buttons
    document.querySelectorAll('.capsule-lang-select').forEach(sel => {
      sel.value = lang;
    });
    document.querySelectorAll('[data-shell-lang]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-shell-lang') === lang);
    });

    // Update document attributes
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // Notify any page-specific handlers (index.html, plan.html, reviews.html)
    window.dispatchEvent(new CustomEvent('rotw-lang-change', { detail: { lang } }));

    if (typeof window.applyLanguage === 'function') {
      window.applyLanguage(lang);
    } else if (typeof window.setLang === 'function') {
      window.setLang(lang);
    }

    // Handle notebook page redirection across languages if on a notebook page
    handleNotebookLangSwitch(lang);

    // Refresh live clocks in new locale
    updateLiveClocks();
  }

  function handleNotebookLangSwitch(targetLang) {
    if (window.__rotwInit) return;
    const loc = window.location.pathname;

    // 1. Destination and Notes sections (subfolder per lang: /destinations/ru/page.html or /notes/ru/page.html)
    const matchSub = loc.match(/\/(notes|destinations)\/(?:(ru|ar)\/)?([^/]+\.html)?$/);
    if (matchSub) {
      const section = matchSub[1];
      const currentLangPrefix = matchSub[2] || 'en';
      const pageFile = matchSub[3] || 'index.html';
      if (currentLangPrefix === targetLang) return;
      let newUrl = '';
      if (currentLangPrefix === 'en') {
        newUrl = targetLang === 'en' ? pageFile : `${targetLang}/${pageFile}`;
      } else {
        newUrl = targetLang === 'en' ? `../${pageFile}` : `../${targetLang}/${pageFile}`;
      }
      try { sessionStorage.setItem('rotw-transition', '1'); } catch(_) {}
      document.documentElement.classList.add('page-leaving');
      window.location.href = newUrl;
      return;
    }

    // 2. Journeys & Blog sections (/journeys/..., /ru/journeys/..., /blog/..., /ru/blog/...)
    const matchGroup = loc.match(/(?:\/(ru|ar))?\/(journeys|blog)\/(?:(ru|ar)\/)?([^/]+\.html)?$/);
    if (matchGroup) {
      const currentLangPrefix = matchGroup[1] || matchGroup[3] || 'en';
      const group = matchGroup[2];
      const pageFile = matchGroup[4] || 'index.html';
      if (currentLangPrefix === targetLang) return;
      let newUrl = '';
      if (currentLangPrefix === 'en') {
        newUrl = targetLang === 'en' ? pageFile : `../${targetLang}/${group}/${pageFile}`;
      } else {
        newUrl = targetLang === 'en' ? `../../${group}/${pageFile}` : `../../${targetLang}/${group}/${pageFile}`;
      }
      try { sessionStorage.setItem('rotw-transition', '1'); } catch(_) {}
      document.documentElement.classList.add('page-leaving');
      window.location.href = newUrl;
      return;
    }

    // 3. Root static pages (/experiences.html, /ru/experiences.html, /contact.html, etc.)
    const matchRoot = loc.match(/(?:\/(ru|ar))?\/([^/]+\.html)$/);
    if (matchRoot) {
      const currentLangPrefix = matchRoot[1] || 'en';
      const pageFile = matchRoot[2];
      // Skip home, plan, reviews which handle live language switching in-page
      if (pageFile === 'index.html' || pageFile === 'plan.html' || pageFile === 'reviews.html') return;
      if (currentLangPrefix === targetLang) return;
      let newUrl = '';
      if (currentLangPrefix === 'en') {
        newUrl = `${targetLang}/${pageFile}`;
      } else {
        newUrl = targetLang === 'en' ? `../${pageFile}` : `../${targetLang}/${pageFile}`;
      }
      try { sessionStorage.setItem('rotw-transition', '1'); } catch(_) {}
      document.documentElement.classList.add('page-leaving');
      window.location.href = newUrl;
    }
  }

  // Bind language switcher select elements
  document.querySelectorAll('.capsule-lang-select').forEach(sel => {
    sel.value = getCurrentLang();
    sel.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  });

  // Bind any endonym language buttons/chips
  document.querySelectorAll('[data-shell-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-shell-lang');
      if (lang) setLanguage(lang);
    });
  });

  /* ============================================================
     3. MOBILE CAPSULE MENU DRAWER (<1024px)
     ============================================================ */
  const menuBtn = document.getElementById('btn-capsule-menu');
  const menuDrawer = document.getElementById('shell-menu-drawer');
  const menuCloseBtn = document.getElementById('btn-drawer-close');

  function openMenuDrawer() {
    if (!menuDrawer) return;
    menuDrawer.classList.add('open');
    menuDrawer.setAttribute('aria-hidden', 'false');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    if (menuCloseBtn) menuCloseBtn.focus();
  }

  function closeMenuDrawer() {
    if (!menuDrawer) return;
    menuDrawer.classList.remove('open');
    menuDrawer.setAttribute('aria-hidden', 'true');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.focus();
    }
  }

  if (menuBtn) menuBtn.addEventListener('click', openMenuDrawer);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenuDrawer);

  if (menuDrawer) {
    menuDrawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenuDrawer);
    });
  }

  // Global Esc key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menuDrawer && menuDrawer.classList.contains('open')) {
        closeMenuDrawer();
      }
    }
  });

  /* ============================================================
     4. LIVE TIMEZONE CLOCKS (Moscow, Dubai, Mumbai, Muscat, HK)
     ============================================================ */
  const TIMEZONES = {
    moscow: 'Europe/Moscow',
    dubai: 'Asia/Dubai',
    mumbai: 'Asia/Kolkata',
    muscat: 'Asia/Muscat',
    hongkong: 'Asia/Hong_Kong'
  };

  function updateLiveClocks() {
    const lang = getCurrentLang();
    const now = new Date();

    Object.keys(TIMEZONES).forEach(cityKey => {
      const tz = TIMEZONES[cityKey];
      try {
        const timeStr = new Intl.DateTimeFormat(lang, {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: tz
        }).format(now);

        document.querySelectorAll(`[data-clock="${cityKey}"]`).forEach(el => {
          el.textContent = timeStr;
        });
      } catch (_) {}
    });
  }

  updateLiveClocks();
  setInterval(updateLiveClocks, 30000);

  /* ============================================================
     5. NOTEBOOK ENVELOPE FOOTER INTERSECTION OBSERVER
     Fades out fixed envelope when footer is in view
     ============================================================ */
  function initFooterObserver() {
    const footer = document.querySelector('footer.rotw-shell-footer');
    if (!footer) return;

    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries[0].isIntersecting;
      document.body.classList.toggle('footer-in-view', isVisible);
      const env = document.querySelector('.envelope');
      if (env) {
        env.classList.toggle('footer-visible', isVisible);
      }
    }, { threshold: 0.01 });

    observer.observe(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFooterObserver);
  } else {
    initFooterObserver();
  }

  /* ============================================================
     6. SASHA LINE EVENT HELPER
     ============================================================ */
  window.emitSashaLine = function(text, id = 'manual') {
    const lang = getCurrentLang();
    window.dispatchEvent(new CustomEvent('sasha-line', {
      detail: { lang, text, id }
    }));
  };

  // Initial language sync
  const folderMatch = window.location.pathname.match(/\/(?:notes|destinations)\/(?:(ru|ar)\/)?[^/]*$/);
  if (folderMatch) {
    window.__rotwInit = true;
    setLanguage(folderMatch[1] || 'en');
    window.__rotwInit = false;
  } else {
    setLanguage(getCurrentLang());
  }
})();
