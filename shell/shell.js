/**
 * ROTW Travels · Shared Shell JavaScript
 * - Throttled compass needle rotation tracking scroll (fixed capsule, zero shrinkage)
 * - 4-Language switcher (en, ru, ar RTL, hi) syncing to localStorage 'rotw-lang'
 * - Mobile menu overlay (<1024px) with focus trap & Esc handling
 * - Sasha's Dock & Full Directory disclosure tray open/close
 * - Live timezone clocks (Moscow, Dubai, Mumbai, Muscat, Hong Kong) via Intl.DateTimeFormat
 * - Seamless tucking on modal / lightbox / arrival overlay
 */

(function () {
  'use strict';

  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     1. COMPASS NEEDLE SCROLL ROTATION
     ============================================================ */
  const needle = document.getElementById('shell-compass-needle');
  let ticking = false;
  let currentRotation = 0;
  let targetRotation = 0;

  function updateNeedle() {
    currentRotation += (targetRotation - currentRotation) * 0.15;
    if (Math.abs(targetRotation - currentRotation) > 0.1) {
      if (needle) needle.style.transform = `rotate(${currentRotation}deg)`;
      window.requestAnimationFrame(updateNeedle);
    } else {
      currentRotation = targetRotation;
      if (needle) needle.style.transform = `rotate(${currentRotation}deg)`;
      ticking = false;
    }
  }

  function onScroll() {
    if (isReduced || !needle) return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
    targetRotation = progress * 360;

    if (!ticking) {
      window.requestAnimationFrame(updateNeedle);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ============================================================
     2. LANGUAGE SWITCHER (rotw-lang)
     ============================================================ */
  const LANGS = ['en', 'ru', 'ar', 'hi'];

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
    // Handle both /notes/ and /destinations/
    const match = loc.match(/\/(notes|destinations)\/(?:(ru|ar|hi)\/)?([^/]+\.html)?$/);
    if (!match) return;

    const currentLangPrefix = match[2] || 'en';
    const pageFile = match[3] || 'index.html';

    if (currentLangPrefix === targetLang) return;

    let newUrl = '';
    // Determine path back to /notes/ or /destinations/
    if (currentLangPrefix === 'en') {
      newUrl = targetLang === 'en' ? pageFile : `${targetLang}/${pageFile}`;
    } else {
      newUrl = targetLang === 'en' ? `../${pageFile}` : `../${targetLang}/${pageFile}`;
    }
    window.location.href = newUrl;
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
  const mainContent = document.querySelector('main') || document.body;
  const dock = document.getElementById('rotw-dock');
  const guideEl = document.getElementById('guide');

  function openMenuDrawer() {
    if (!menuDrawer) return;
    menuDrawer.classList.add('open');
    menuDrawer.setAttribute('aria-hidden', 'false');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    if (dock) dock.classList.add('tuck');
    if (guideEl) guideEl.classList.add('tuck');
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
    if (dock && !isTrayOpen()) dock.classList.remove('tuck');
    if (guideEl && !isTrayOpen()) guideEl.classList.remove('tuck');
  }

  if (menuBtn) menuBtn.addEventListener('click', openMenuDrawer);
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenuDrawer);

  if (menuDrawer) {
    menuDrawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenuDrawer);
    });
  }

  /* ============================================================
     4. SASHA'S DOCK & FULL DIRECTORY DISCLOSURE TRAY
     ============================================================ */
  const trayBtn = document.getElementById('btn-dock-directory');
  const tray = document.getElementById('rotw-directory-tray');
  const backdrop = document.getElementById('rotw-tray-backdrop');
  const trayCloseBtn = document.getElementById('btn-tray-close');
  const trayHeading = document.getElementById('rotw-directory-heading');

  function isTrayOpen() {
    return tray && tray.classList.contains('open');
  }

  function openTray() {
    if (!tray) return;
    tray.classList.add('open');
    tray.removeAttribute('hidden');
    if (backdrop) backdrop.classList.add('open');
    if (guideEl) guideEl.classList.add('tuck');
    if (trayBtn) trayBtn.setAttribute('aria-expanded', 'true');
    if (trayHeading) {
      trayHeading.setAttribute('tabindex', '-1');
      trayHeading.focus();
    } else if (trayCloseBtn) {
      trayCloseBtn.focus();
    }
  }

  function closeTray() {
    if (!tray) return;
    tray.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    if (guideEl) guideEl.classList.remove('tuck');
    if (trayBtn) {
      trayBtn.setAttribute('aria-expanded', 'false');
      trayBtn.focus();
    }
  }

  if (trayBtn) {
    trayBtn.addEventListener('click', () => {
      if (isTrayOpen()) closeTray();
      else openTray();
    });
  }

  if (backdrop) backdrop.addEventListener('click', closeTray);
  if (trayCloseBtn) trayCloseBtn.addEventListener('click', closeTray);

  // Global Esc key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isTrayOpen()) {
        closeTray();
      } else if (menuDrawer && menuDrawer.classList.contains('open')) {
        closeMenuDrawer();
      }
    }
  });

  /* ============================================================
     5. LIVE TIMEZONE CLOCKS (Moscow, Dubai, Mumbai, Muscat, HK)
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
     6. AUTOMATIC DOCK TUCKING INTERPLAY
     Tucks dock when arrival video or image lightbox is active
     ============================================================ */
  const arriveEl = document.getElementById('arrive');
  if (arriveEl) {
    const arriveObs = new MutationObserver(() => {
      const isVisible = !arriveEl.hidden && arriveEl.style.display !== 'none';
      if (dock) dock.classList.toggle('tuck', isVisible);
      if (guideEl) guideEl.classList.toggle('tuck', isVisible);
    });
    arriveObs.observe(arriveEl, { attributes: true, attributeFilter: ['hidden', 'style'] });
  }

  // Tucking when lightbox in notebook opens
  const lightboxEl = document.getElementById('lightbox') || document.querySelector('.lb-pop');
  if (lightboxEl) {
    const lbObs = new MutationObserver(() => {
      const isOpen = lightboxEl.classList.contains('open') || (!lightboxEl.hidden && lightboxEl.style.display !== 'none');
      if (dock) dock.classList.toggle('tuck', isOpen);
      if (guideEl) guideEl.classList.toggle('tuck', isOpen);
    });
    lbObs.observe(lightboxEl, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }

  // Initial sync. On folder-based pages (notebook, destinations) the language in the URL wins:
  // never redirect on load, just remember it.
  const folderMatch = window.location.pathname.match(/\/(?:notes|destinations)\/(?:(ru|ar|hi)\/)?[^/]*$/);
  if (folderMatch) {
    window.__rotwInit = true;
    setLanguage(folderMatch[1] || 'en');
    window.__rotwInit = false;
  } else {
    setLanguage(getCurrentLang());
  }
})();
