const fs = require('fs');
const path = require('path');

const navData = JSON.parse(fs.readFileSync(path.join(__dirname, 'nav.json'), 'utf8'));

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function resolveHref(href, relBase) {
  if (!href) return '#';
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http')) return href;
  if (href.startsWith('#')) return href;
  const cleanBase = relBase === '.' ? '' : relBase + '/';
  return cleanBase + href;
}

function renderHeader({ lang = 'en', relBase = '.', activePage = '' }) {
  const L = lang || 'en';
  const cta = navData.ctaPlan;
  const ctaLabel = esc(cta.label[L] || cta.label.en);
  const homeHref = resolveHref('index.html', relBase);
  const planHref = resolveHref(cta.href, relBase);

  // Render main nav items
  const navItemsHtml = navData.mainNav.map(item => {
    const isCurrent = activePage === item.id ? ' aria-current="page"' : '';
    const label = esc(item.label[L] || item.label.en);
    const itemHref = resolveHref(item.href, relBase);
    return `<a href="${itemHref}" class="capsule-link"${isCurrent}>
      <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#${item.icon}"/></svg>
      <span>${label}</span>
    </a>`;
  }).join('\n      ');

  // Render language options for dropdown
  const langOptionsHtml = navData.languages.map(lg => {
    const selected = lg.code === L ? ' selected' : '';
    return `<option value="${lg.code}"${selected}>${esc(lg.endonym)}</option>`;
  }).join('\n          ');

  // Render drawer links for mobile
  const drawerLinksHtml = navData.mainNav.map(item => {
    const isCurrent = activePage === item.id ? ' aria-current="page"' : '';
    const label = esc(item.label[L] || item.label.en);
    const itemHref = resolveHref(item.href, relBase);
    return `<li>
      <a href="${itemHref}" class="drawer-nav-row"${isCurrent}>
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#${item.icon}"/></svg>
        <span>${label}</span>
      </a>
    </li>`;
  }).join('\n      ');

  // Language chips for mobile drawer
  const drawerLangChipsHtml = navData.languages.map(lg => {
    const activeClass = lg.code === L ? ' active' : '';
    return `<button class="drawer-lang-chip${activeClass}" data-shell-lang="${lg.code}">${esc(lg.endonym)}</button>`;
  }).join('\n        ');

  return `<!-- SHELL:HEADER -->
<a href="#main" class="shell-skip">${L === 'ru' ? 'Перейти к основному содержимому' : L === 'ar' ? 'انتقل إلى المحتوى الرئيسي' : L === 'hi' ? 'मुख्य सामग्री पर जाएँ' : 'Skip to main content'}</a>

<header class="shell-header-wrapper" role="banner">
  <div class="compass-capsule" id="compass-capsule">
    <!-- Company Logo (FIX 1) -->
    <a href="${homeHref}" class="capsule-brand" aria-label="ROTW Travels">
      <img class="capsule-logo" src="${relBase}/assets/site/logo-white.png" alt="ROTW Travels" width="80" height="32">
    </a>

    <!-- Category Nav Links -->
    <nav class="capsule-nav" aria-label="Main Navigation">
      ${navItemsHtml}
    </nav>

    <!-- Right Controls: Language Endonym + Gold Pill CTA -->
    <div class="capsule-actions">
      <div class="capsule-lang-wrap">
        <svg class="shell-icon capsule-lang-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-globe"/></svg>
        <select class="capsule-lang-select" aria-label="Select language">
          ${langOptionsHtml}
        </select>
        <svg class="shell-icon capsule-lang-arrow" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-chevron-down"/></svg>
      </div>

      <a href="${planHref}" class="btn-pill-plan">
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-paper-plane"/></svg>
        <span>${ctaLabel}</span>
      </a>

      <button class="btn-capsule-menu" id="btn-capsule-menu" aria-label="Open menu" aria-expanded="false" aria-controls="shell-menu-drawer">
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-menu"/></svg>
      </button>
    </div>
  </div>
</header>

<!-- Full-screen Mobile Menu Drawer (<1024px) -->
<div class="shell-menu-drawer" id="shell-menu-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Navigation Menu">
  <div class="drawer-top-row">
    <a href="${homeHref}" class="capsule-brand" aria-label="ROTW Travels">
      <img class="capsule-logo" src="${relBase}/assets/site/logo-white.png" alt="ROTW Travels" width="70" height="28">
    </a>
    <button class="drawer-close-btn" id="btn-drawer-close" aria-label="Close menu">
      <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-close"/></svg>
    </button>
  </div>

  <div class="drawer-scroll-area">
    <ul class="drawer-nav-list">
      ${drawerLinksHtml}
    </ul>

    <div class="drawer-lang-chips">
      ${drawerLangChipsHtml}
    </div>
  </div>

  <div class="drawer-cta-wrap">
    <a href="${planHref}" class="btn-pill-plan drawer-cta-btn">
      <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-paper-plane"/></svg>
      <span>${ctaLabel}</span>
    </a>
  </div>
</div>
<!-- /SHELL:HEADER -->`;
}

function renderFooter({ lang = 'en', relBase = '.', activePage = '', speechText = '', isHome = false }) {
  const L = lang || 'en';
  const cta = navData.ctaPlan;
  const ctaLabel = esc(cta.label[L] || cta.label.en);
  const planHref = resolveHref(cta.href, relBase);
  const dir = navData.directory;
  const dirTitle = esc(dir.title[L] || dir.title.en);
  const dirSub = esc(dir.sub[L] || dir.sub.en);
  const dirOpenText = esc(dir.openBtn[L] || dir.openBtn.en);
  const dirCloseText = esc(dir.closeBtn[L] || dir.closeBtn.en);

  // Default speech text if not provided
  let speech = speechText;
  if (!speech) {
    if (isHome) {
      speech = L === 'ru' ? 'Привет! Я Саша, ваш гид по России.' : L === 'ar' ? 'مرحبًا! أنا ساشا، مرشدك عبر روسيا.' : L === 'hi' ? 'नमस्ते! मैं साशा हूँ, पूरे रूस में आपका गाइड।' : 'Privet! I’m Sasha, your guide across Russia.';
    } else {
      speech = L === 'ru' ? 'Вопросы перед сборами? Напишите нам в Москве.' : L === 'ar' ? 'لديك أسئلة قبل السفر؟ اكتب إلينا في موسكو.' : L === 'hi' ? 'यात्रा से पहले कोई सवाल? मॉस्को में हमें लिखें।' : 'Questions before you pack? Write to the Moscow team.';
    }
  }

  // Sasha Note
  const sashaNote = navData.sashaNote;
  const noteCopy = esc(sashaNote.text[L] || sashaNote.text.en);
  const noteSignature = esc(sashaNote.signature[L] || sashaNote.signature.en);
  const noteBtnWrite = esc(sashaNote.btnWrite[L] || sashaNote.btnWrite.en);

  // Doors
  const d1 = navData.doors.d1;
  const d2 = navData.doors.d2;
  const d1Title = esc(d1.title[L] || d1.title.en);
  const d1Btn = esc(d1.btn[L] || d1.btn.en);
  const d1Items = (d1.items[L] || d1.items.en).map(item => `<li>${esc(item)}</li>`).join('\n              ');

  const d2Title = esc(d2.title[L] || d2.title.en);
  const d2Btn = esc(d2.btn[L] || d2.btn.en);
  const d2Items = (d2.items[L] || d2.items.en).map(item => `<li>${esc(item)}</li>`).join('\n              ');

  // Tag 1: Places & Expeditions links
  const destLinksHtml = navData.cities.map(c => {
    const cName = esc(c.name[L] || c.name.en);
    // Link to city notebook page
    const cityHref = resolveHref(`notes/${c.id}.html`, relBase);
    return `<li><a href="${cityHref}">${cName}</a></li>`;
  }).join('\n                ');

  // Journeys links
  const journeyLinksHtml = navData.journeys.map(j => {
    const jTitle = esc(j.title[L] || j.title.en);
    const jHref = resolveHref('index.html#journeys', relBase);
    return `<li><a href="${jHref}">${jTitle} (${j.days} ${L === 'ru' ? 'дней' : L === 'ar' ? 'أيام' : L === 'hi' ? 'दिन' : 'days'})</a></li>`;
  }).join('\n                ');

  // Tag 2: Services
  const t2 = navData.tags.tag2;
  const t2Title = esc(t2.title[L] || t2.title.en);
  const t2Btn = esc(t2.btn[L] || t2.btn.en);
  const t2Items = (t2.items[L] || t2.items.en).map(item => `<li>${esc(item)}</li>`).join('\n                ');

  // Tag 3: Clocks & Address
  const t3 = navData.tags.tag3;
  const t3Title = esc(t3.title[L] || t3.title.en);
  const addr = esc(navData.address[L] || navData.address.en);

  // Clocks HTML
  const clocksHtml = navData.offices.map(o => {
    const cityName = esc(o.city[L] || o.city.en);
    return `<div class="tray-clock-dial">
          <span class="dial-city">${cityName}</span>
          <span class="dial-time" data-clock="${o.id}"><span dir="ltr">--:--</span></span>
        </div>`;
  }).join('\n        ');

  // Language Endonyms
  const langEndonymsHtml = navData.languages.map(lg => {
    const activeClass = lg.code === L ? ' active' : '';
    return `<button class="tray-lang-btn${activeClass}" data-shell-lang="${lg.code}">${esc(lg.endonym)}</button>`;
  }).join('\n      ');

  // Legal row slots
  const leg = navData.legal;
  const s1 = esc(leg.slot1[L] || leg.slot1.en);
  const s2 = esc(leg.slot2[L] || leg.slot2.en);
  const s3 = esc(leg.slot3[L] || leg.slot3.en);

  return `<!-- SHELL:FOOTER -->
<footer class="rotw-shell-footer" role="contentinfo">
  <!-- Collapsed Persistent Dock Console -->
  <aside class="rotw-dock" id="rotw-dock" aria-label="Sasha's Travel Console">
    <div class="dock-sasha-block" id="bubble">
      <div class="dock-sasha-avatar">
        <img src="${relBase}/assets/sasha.webp" alt="Sasha" width="40" height="40" loading="lazy">
      </div>
      <b id="guide-name" style="display:none;">Sasha</b>
      <span class="dock-speech" id="guide-text">${esc(speech)}</span>
    </div>

    <div class="dock-actions">
      <button class="btn-dock-dir" id="btn-dock-directory" aria-expanded="false" aria-controls="rotw-directory-tray">
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-menu"/></svg>
        <span class="label-text">${dirOpenText}</span>
      </button>

      <a href="${planHref}" class="btn-dock-plan">
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-paper-plane"/></svg>
        <span class="label-text">${ctaLabel}</span>
      </a>
    </div>
  </aside>

  <!-- Slide-Up Full Directory Disclosure Backdrop -->
  <div class="rotw-tray-backdrop" id="rotw-tray-backdrop" aria-hidden="true"></div>

  <!-- Slide-Up Full Directory Disclosure Tray -->
  <div class="rotw-directory-tray" id="rotw-directory-tray" role="region" aria-label="${dirTitle}" hidden="until-found">
    <!-- Tray Header -->
    <div class="tray-header">
      <div class="tray-title-block">
        <h3 id="rotw-directory-heading">${dirTitle}</h3>
        <p>${dirSub}</p>
      </div>
      <button class="tray-close-btn" id="btn-tray-close" aria-label="${dirCloseText}">
        <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-close"/></svg>
      </button>
    </div>

    <!-- Tray Scrollable Content -->
    <div class="tray-scroll-body">
      <!-- 1. Sasha's Note Slip -->
      <article class="sasha-note-card">
        <div class="note-tape note-tape-left" aria-hidden="true"></div>
        <div class="note-tape note-tape-right" aria-hidden="true"></div>
        <p class="sasha-handwriting-p">
          “${noteCopy}”
          <span class="sasha-signature-span">${noteSignature}</span>
        </p>
        <div class="sasha-note-actions">
          <a href="${planHref}" class="btn-note-plan">
            <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-paper-plane"/></svg>
            <span>${ctaLabel}</span>
          </a>
          <a href="mailto:inbound@rotwtravels.com" class="btn-note-mail">
            <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-mail"/></svg>
            <span>${noteBtnWrite}</span>
          </a>
        </div>
      </article>

      <!-- 2. Two Doors Block -->
      <div class="tray-doors-block">
        <!-- Door 1: Travellers -->
        <div class="tray-door-card tray-door-light">
          <div>
            <h4>${d1Title}</h4>
            <ul class="tray-door-list">
              ${d1Items}
            </ul>
          </div>
          <a href="${planHref}" class="btn-pill-plan tray-door-btn">
            <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-paper-plane"/></svg>
            <span>${d1Btn}</span>
          </a>
        </div>

        <!-- Door 2: Agents & Tour Operators -->
        <div class="tray-door-card tray-door-dark">
          <div>
            <h4>${d2Title}</h4>
            <ul class="tray-door-list">
              ${d2Items}
            </ul>
          </div>
          <a href="${resolveHref('plan.html#agent', relBase)}" class="btn-pill-plan tray-door-btn" style="background:transparent;border:1px solid var(--shell-gold);color:var(--shell-gold);">
            <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-briefcase"/></svg>
            <span>${d2Btn}</span>
          </a>
        </div>
      </div>

      <!-- 3. Directory as Luggage Tags -->
      <div class="tray-tags-container">
        <!-- Desktop 3-Column Tags -->
        <div class="desktop-tags-grid">
          <!-- Tag 1: Places & Expeditions -->
          <article class="luggage-tag">
            <div class="tag-eyelet-row">
              <div class="tag-twine" aria-hidden="true"></div>
              <div class="tag-eyelet" aria-hidden="true"><div class="tag-eyelet-hole"></div></div>
            </div>
            <div class="tag-header">
              <div class="tag-category-kicker">TAG 01 · ROUTE &amp; STOPS</div>
              <h4>${esc(navData.tags.tag1.title[L] || navData.tags.tag1.title.en)}</h4>
            </div>
            <div class="tag-body">
              <ul class="tag-dest-grid">
                ${destLinksHtml}
              </ul>
              <div class="tag-section-subhead">${esc(navData.mainNav[1].label[L] || 'Journeys')}</div>
              <ul class="tag-sublinks">
                ${journeyLinksHtml}
              </ul>
              <div class="tag-section-subhead">${esc(dir.contact[L] || 'More')}</div>
              <ul class="tag-sublinks">
                <li><a href="${resolveHref('reviews.html', relBase)}">${esc(dir.reviews[L] || 'Traveller reviews')}</a></li>
                <li><a href="${resolveHref('notes/index.html', relBase)}">${esc(navData.mainNav[4].label[L] || 'Sasha’s notebook')}</a></li>
              </ul>
            </div>
          </article>

          <!-- Tag 2: Agents & Services -->
          <article class="luggage-tag">
            <div class="tag-eyelet-row">
              <div class="tag-twine" aria-hidden="true"></div>
              <div class="tag-eyelet" aria-hidden="true"><div class="tag-eyelet-hole"></div></div>
            </div>
            <div class="tag-header">
              <div class="tag-category-kicker">TAG 02 · TRADE &amp; CONCIERGE</div>
              <h4>${t2Title}</h4>
            </div>
            <div class="tag-body">
              <ul class="tag-services-list">
                ${t2Items}
              </ul>
              <a href="${resolveHref('plan.html#agent', relBase)}" class="tag-cta-btn">
                <span>${t2Btn}</span>
                <svg class="shell-icon shell-icon-flip" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-arrow-right"/></svg>
              </a>
            </div>
          </article>

          <!-- Tag 3: Moscow HQ & Clocks -->
          <article class="luggage-tag">
            <div class="tag-eyelet-row">
              <div class="tag-twine" aria-hidden="true"></div>
              <div class="tag-eyelet" aria-hidden="true"><div class="tag-eyelet-hole"></div></div>
            </div>
            <div class="tag-header">
              <div class="tag-category-kicker">TAG 03 · HEADQUARTERS</div>
              <h4>${t3Title}</h4>
            </div>
            <div class="tag-body">
              <div class="tag-hq-address">
                <strong>ROTW Travels</strong><br>
                ${addr}
              </div>
              <div class="tag-contact-lines">
                <div>Moscow: <a href="tel:+79309454007"><span dir="ltr">+7 930 945 4007</span></a></div>
                <div>Dubai: <a href="tel:+97143384075"><span dir="ltr">+971 4 338 4075</span></a></div>
                <div>Mumbai: <a href="tel:+919821869339"><span dir="ltr">+91 98218 69339</span></a></div>
                <div>Inbound: <a href="mailto:inbound@rotwtravels.com"><span dir="ltr">inbound@rotwtravels.com</span></a></div>
              </div>
            </div>
          </article>
        </div>

        <!-- Mobile Accordions (<860px) -->
        <div class="mobile-tag-accordion">
          <details class="accordion-tag" open>
            <summary>
              <span>Tag 01 · ${esc(navData.tags.tag1.title[L] || navData.tags.tag1.title.en)}</span>
              <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-chevron-down"/></svg>
            </summary>
            <div class="accordion-content">
              <ul class="tag-dest-grid">
                ${destLinksHtml}
              </ul>
              <div class="tag-section-subhead" style="margin-top:12px;">${esc(navData.mainNav[1].label[L] || 'Journeys')}</div>
              <ul class="tag-sublinks">
                ${journeyLinksHtml}
              </ul>
            </div>
          </details>

          <details class="accordion-tag">
            <summary>
              <span>Tag 02 · ${t2Title}</span>
              <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-chevron-down"/></svg>
            </summary>
            <div class="accordion-content">
              <ul class="tag-services-list">
                ${t2Items}
              </ul>
              <a href="${resolveHref('plan.html#agent', relBase)}" class="tag-cta-btn" style="margin-top:14px;">
                <span>${t2Btn}</span>
                <svg class="shell-icon shell-icon-flip" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-arrow-right"/></svg>
              </a>
            </div>
          </details>

          <details class="accordion-tag">
            <summary>
              <span>Tag 03 · ${t3Title}</span>
              <svg class="shell-icon" aria-hidden="true"><use href="${relBase}/assets/icons.svg#icon-chevron-down"/></svg>
            </summary>
            <div class="accordion-content">
              <div class="tag-hq-address" style="border:0;padding-bottom:6px;">
                <strong>ROTW Travels</strong><br>
                ${addr}
              </div>
              <div class="tag-contact-lines">
                <div>Moscow: <a href="tel:+79309454007"><span dir="ltr">+7 930 945 4007</span></a></div>
                <div>Dubai: <a href="tel:+97143384075"><span dir="ltr">+971 4 338 4075</span></a></div>
                <div>Mumbai: <a href="tel:+919821869339"><span dir="ltr">+91 98218 69339</span></a></div>
                <div>Email: <a href="mailto:inbound@rotwtravels.com"><span dir="ltr">inbound@rotwtravels.com</span></a></div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- 4. Five Live Clocks -->
      <section class="tray-clocks-section" aria-label="Bureau time zones">
        <div class="tray-clocks-head">Bureau Local Times</div>
        <div class="tray-clocks-row">
          ${clocksHtml}
        </div>
      </section>

      <!-- 5. Languages Section -->
      <div class="tray-lang-section" role="group" aria-label="Language options">
        ${langEndonymsHtml}
      </div>

      <!-- 6. Legal Row with Dashed Slots -->
      <div class="tray-legal-section">
        <div class="legal-slots-grid">
          <div class="legal-slot">${s1}</div>
          <div class="legal-slot">${s2}</div>
          <div class="legal-slot">${s3}</div>
        </div>
        <div class="legal-bottom-row">
          <span>${esc(leg.copyright)} · ${addr}</span>
          <span class="legal-tagline" lang="ru">${esc(leg.tagline)}</span>
        </div>
      </div>
    </div>
  </div>
</footer>
<!-- /SHELL:FOOTER -->`;
}

module.exports = {
  renderHeader,
  renderFooter,
  navData
};
