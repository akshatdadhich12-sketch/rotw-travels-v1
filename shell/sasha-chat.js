/**
 * ROTW Travels · Sasha Chat Component (sasha-chat.js)
 * Scripted conversation cards inside the page flow.
 * - Full chat card: destination pages, home page story replay, plan page.
 * - Compact chat card: home page chapters, hub, reviews.
 * - Strict adherence to spec: NO AI, NO free typing, no fake status dots.
 * - 700ms typing indicator before Sasha speaks.
 * - Quick-reply chips (44px touch targets) on visitor side turning into bubbles.
 * - Replay button, Plan a trip link, Write to Moscow team mailto.
 * - Plain HTML fallback without JS.
 * - Prefers-reduced-motion: all messages shown at once, no typing delay.
 * - RTL mirrored via CSS logical properties.
 * - Dispatches 'sasha-line' CustomEvent on every line shown.
 */

(function () {
  'use strict';

  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function emitSashaLine(lang, text, id) {
    try {
      window.dispatchEvent(new CustomEvent('sasha-line', {
        detail: { lang, text, id }
      }));
    } catch (_) {}
  }

  function getLang() {
    return document.documentElement.lang || localStorage.getItem('rotw-lang') || 'en';
  }

  /* -------------------------------------------------------------
   * Full Chat Card Logic
   * ------------------------------------------------------------- */
  function initFullChat(el) {
    if (el.__sashaChatInit) return;
    el.__sashaChatInit = true;

    const lang = getLang();
    let data = null;

    // 1. Read config from attribute or script tag
    const attrData = el.getAttribute('data-chat-config');
    if (attrData) {
      try {
        data = JSON.parse(attrData);
      } catch (e) {
        console.warn('Failed to parse data-chat-config:', e);
      }
    }
    if (!data) {
      const dataScript = el.querySelector('script[type="application/json"]');
      if (dataScript) {
        try {
          data = JSON.parse(dataScript.textContent);
        } catch (e) {
          console.warn('Failed to parse chat data script:', e);
        }
      }
    }

    if (!data) return;

    // Normalize config: support either steps array or { greet, chips, final }
    let steps = [];
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      steps = data.steps;
    } else if (data.greet && Array.isArray(data.chips)) {
      // Step 0: Initial greet + chips
      steps.push({
        id: 'greet',
        text: data.greet,
        chips: data.chips.map((c, i) => ({
          id: c.id || ('chip-' + i),
          label: c.label,
          reply: c.reply,
          speechId: c.speechId || ('reply-' + i)
        }))
      });
    } else {
      return;
    }

    const messagesContainer = el.querySelector('.chat-messages, .sasha-chat-messages');
    let actionsContainer = el.querySelector('.chat-actions, .sasha-chat-chips, .sasha-chat-controls');
    let typingIndicator = el.querySelector('.chat-typing, .sasha-chat-typing');

    if (!messagesContainer) return;

    // Create typing indicator if not present
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.className = 'chat-typing sasha-chat-typing';
      typingIndicator.setAttribute('hidden', '');
      typingIndicator.setAttribute('aria-hidden', 'true');
      typingIndicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      messagesContainer.parentNode.insertBefore(typingIndicator, actionsContainer || messagesContainer.nextSibling);
    }

    let isTyping = false;

    function renderTyping(show) {
      if (!typingIndicator) return;
      if (show && !isReduced) {
        typingIndicator.removeAttribute('hidden');
        typingIndicator.setAttribute('aria-hidden', 'false');
      } else {
        typingIndicator.setAttribute('hidden', '');
        typingIndicator.setAttribute('aria-hidden', 'true');
      }
    }

    function addSashaBubble(text, id) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble bubble-sasha sasha-bubble sasha-bubble-agent';
      bubble.setAttribute('role', 'listitem');
      bubble.innerHTML = '<p>' + text + '</p>';
      messagesContainer.appendChild(bubble);
      bubble.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'nearest' });
      emitSashaLine(lang, text, id);
    }

    function addVisitorBubble(text) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble bubble-visitor sasha-bubble sasha-bubble-visitor';
      bubble.setAttribute('role', 'listitem');
      bubble.innerHTML = '<p>' + text + '</p>';
      messagesContainer.appendChild(bubble);
      bubble.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'nearest' });
    }

    function renderInitialChips(chipList) {
      if (!actionsContainer) return;
      actionsContainer.innerHTML = '';
      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'sasha-chat-chips';

      chipList.forEach(chip => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-chip sasha-chat-chip';
        btn.textContent = chip.label;
        btn.addEventListener('click', () => {
          onInitialChipClick(chip);
        });
        chipsWrap.appendChild(btn);
      });
      actionsContainer.appendChild(chipsWrap);
    }

    function onInitialChipClick(chip) {
      if (isTyping) return;
      addVisitorBubble(chip.label);
      if (actionsContainer) actionsContainer.innerHTML = '';

      if (isReduced) {
        addSashaBubble(chip.reply, chip.speechId || chip.id);
        renderFinalActions();
      } else {
        isTyping = true;
        renderTyping(true);
        setTimeout(() => {
          renderTyping(false);
          isTyping = false;
          addSashaBubble(chip.reply, chip.speechId || chip.id);
          renderFinalActions();
        }, 700);
      }
    }

    function renderFinalActions() {
      if (!actionsContainer) return;
      actionsContainer.innerHTML = '';
      const finalConfig = data.final || {};
      const planLabel = finalConfig.planLabel || (lang === 'ru' ? 'Спланировать поездку' : lang === 'ar' ? 'خطط لرحلتك' : 'Plan a trip');
      const planHref = finalConfig.planHref || 'plan.html';
      const contactLabel = finalConfig.contactLabel || (lang === 'ru' ? 'Написать команде в Москве' : lang === 'ar' ? 'راسل الفريق في موسكو' : 'Write to the Moscow team');
      const contactHref = finalConfig.contactHref || 'mailto:inbound@rotwtravels.com';
      const replayLabel = finalConfig.replayLabel || (lang === 'ru' ? 'Повторить' : lang === 'ar' ? 'إعادة' : 'Replay');

      const wrap = document.createElement('div');
      wrap.className = 'sasha-chat-chips sasha-chat-final';

      const planBtn = document.createElement('a');
      planBtn.className = 'chat-chip sasha-chat-chip sasha-chip-plan';
      planBtn.href = planHref;
      planBtn.textContent = planLabel;
      wrap.appendChild(planBtn);

      const contactBtn = document.createElement('a');
      contactBtn.className = 'chat-chip sasha-chat-chip sasha-chip-contact';
      contactBtn.href = contactHref;
      contactBtn.textContent = contactLabel;
      wrap.appendChild(contactBtn);

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'chat-chip sasha-chat-chip sasha-chip-replay';
      replayBtn.textContent = replayLabel;
      replayBtn.addEventListener('click', restartChat);
      wrap.appendChild(replayBtn);

      actionsContainer.appendChild(wrap);
    }

    function restartChat() {
      messagesContainer.innerHTML = '';
      if (actionsContainer) actionsContainer.innerHTML = '';
      startStep0();
    }

    function startStep0() {
      const step0 = steps[0];
      if (!step0) return;

      if (isReduced) {
        addSashaBubble(step0.text, step0.id);
        if (step0.chips) renderInitialChips(step0.chips);
      } else {
        isTyping = true;
        renderTyping(true);
        setTimeout(() => {
          renderTyping(false);
          isTyping = false;
          addSashaBubble(step0.text, step0.id);
          if (step0.chips) renderInitialChips(step0.chips);
        }, 700);
      }
    }

    // Reduced motion: show all messages immediately
    if (isReduced) {
      messagesContainer.innerHTML = '';
      const step0 = steps[0];
      if (step0) {
        addSashaBubble(step0.text, step0.id);
        if (step0.chips) {
          step0.chips.forEach(c => {
            addSashaBubble(c.reply, c.speechId || c.id);
          });
        }
      }
      renderFinalActions();
      return;
    }

    // Scroll trigger: start only when scrolled into view
    let started = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !started) {
          started = true;
          observer.disconnect();
          messagesContainer.innerHTML = '';
          startStep0();
        }
      });
    }, { threshold: 0.15 });

    observer.observe(el);
  }

  /* -------------------------------------------------------------
   * Compact Chat Card Logic (Home page chapters, etc.)
   * ------------------------------------------------------------- */
  function initCompactChat(el) {
    if (el.__compactChatInit) return;
    el.__compactChatInit = true;

    const bubble = el.querySelector('.chat-bubble, .compact-bubble, .sasha-chat-compact-bubble p, p');
    if (!bubble) return;

    const obs = new MutationObserver(() => {
      const text = bubble.textContent.trim();
      const id = el.getAttribute('data-sasha-id') || el.id || 'compact';
      if (text) emitSashaLine(getLang(), text, id);
    });
    obs.observe(bubble, { childList: true, characterData: true, subtree: true });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          io.disconnect();
          const text = bubble.textContent.trim();
          const id = el.getAttribute('data-sasha-id') || el.id || 'compact';
          if (text) emitSashaLine(getLang(), text, id);
        }
      });
    }, { threshold: 0.1 });
    io.observe(el);
  }

  /* -------------------------------------------------------------
   * Global Initialization
   * ------------------------------------------------------------- */
  function initAll() {
    document.querySelectorAll('.sasha-chat:not(.sasha-chat-compact)').forEach(initFullChat);
    document.querySelectorAll('.sasha-chat-compact').forEach(initCompactChat);
  }

  window.initSashaChat = initAll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
