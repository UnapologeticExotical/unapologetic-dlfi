// dlfi-mobile.js — PWA registration, splash screen, bottom tab bar, FAB,
// haptic feedback, and on-brand filenames for downloads. Mobile-first add-ons.

(function () {
  'use strict';

  // ============================================================
  // PWA — register service worker (only when served over http/https,
  // never on file:// where it errors loudly)
  // ============================================================
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ============================================================
  // SPLASH SCREEN — animated DLFI seal on every fresh load
  // Runs on BOTH phone and desktop. No once-per-session gate —
  // the intro is part of the experience every time you arrive.
  // ============================================================
  function showSplash() {
    // Skip only if we're already standalone (PWA) — that path has its own
    // launch screen from the manifest, so a second splash is redundant.
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (document.getElementById('dlfi-splash')) return;
    const splash = document.createElement('div');
    splash.id = 'dlfi-splash';
    splash.innerHTML = `
      <div class="ds-stage">
        <div class="ds-rings">
          <span></span><span></span><span></span>
        </div>
        <div class="ds-seal">D</div>
        <div class="ds-meta">DEPARTMENT OF LACE FRONT INVESTIGATIONS</div>
        <div class="ds-line"><span class="ds-bar"></span></div>
        <div class="ds-id">CLEARANCE LV-304 · EST. 2026</div>
      </div>
      <div class="ds-scan"></div>
    `;
    document.body.appendChild(splash);
    /* removed overflow lock — splash is pointer-events:none now */
    // Dismiss
    setTimeout(() => splash.classList.add('is-out'), 1600);
    setTimeout(() => {
      try { splash.remove(); } catch (e) {}
      /* overflow lock no longer set; nothing to clear */
      // After the splash clears, surface a one-time scroll hint so
      // non-tech-savvy visitors know there's more below the fold.
      showScrollHint();
    }, 2200);
  }

  // ============================================================
  // SCROLL HINT — pulses after the splash dismisses, on both phone
  // and desktop. Auto-dismisses on first scroll/click/keypress, or
  // after 9 seconds. Only shows once per browser (localStorage).
  // ============================================================
  function showScrollHint() {
    if (document.getElementById('dlfi-scroll-hint')) return;
    // Don't bother if the page is too short to scroll
    if (document.documentElement.scrollHeight <= window.innerHeight + 40) return;
    const hint = document.createElement('div');
    hint.id = 'dlfi-scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = `
      <div class="dsh-bar"></div>
      <div class="dsh-stamp">FIELD NOTICE</div>
      <div class="dsh-title">Keep <em>Scrolling</em>, Recruit.</div>
      <div class="dsh-sub">The file extends below. Cases, evidence, and receipts await.</div>
      <div class="dsh-chev" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <button class="dsh-close" type="button" aria-label="Dismiss">DISMISS ×</button>
    `;
    document.body.appendChild(hint);
    requestAnimationFrame(() => hint.classList.add('is-in'));

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      hint.classList.remove('is-in');
      hint.classList.add('is-out');
      setTimeout(() => { try { hint.remove(); } catch (e) {} }, 600);
      window.removeEventListener('scroll', onScroll, { passive: true });
      window.removeEventListener('wheel', dismiss, { passive: true });
      window.removeEventListener('touchmove', dismiss, { passive: true });
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
    }
    function onScroll() { if (window.scrollY > 24) dismiss(); }
    function onKey(e) {
      if (['ArrowDown','ArrowUp','PageDown','PageUp','Space',' ','End'].includes(e.key)) dismiss();
    }
    function onClick(e) {
      if (e.target.closest('.dsh-close, #dlfi-scroll-hint')) {
        dismiss();
        return;
      }
      // Any other click also dismisses
      dismiss();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    setTimeout(dismiss, 9000);
  }
  window.dlfiShowScrollHint = showScrollHint;
  // Show splash as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showSplash);
  } else {
    showSplash();
  }

  // ============================================================
  // BOTTOM TAB BAR — phone-only, replaces hamburger on touch
  // ============================================================
  const TABS = [
    { id: 'home',      label: 'Home',     glyph: 'home',     page: 'home' },
    { id: 'cases',     label: 'Cases',    glyph: 'folder',   page: 'cases' },
    { id: 'evidence',  label: 'Evidence', glyph: 'eye',      page: 'evidence' },
    { id: 'resources', label: 'Recruit',  glyph: 'badge',    page: 'resources' },
    { id: 'about',     label: 'Agents',   glyph: 'agents',   page: 'about' }
  ];
  const ICONS = {
    home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg>',
    badge:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z"/><circle cx="12" cy="12" r="3"/></svg>',
    agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3.4"/><path d="M2 21c0-3.6 3.1-6 7-6s7 2.4 7 6"/><circle cx="17" cy="9" r="2.6"/><path d="M14 14c2.6.1 6 1.6 8 4.4"/></svg>'
  };

  function buildBottomTabs() {
    if (document.getElementById('dlfi-tabbar')) return;
    const bar = document.createElement('nav');
    bar.id = 'dlfi-tabbar';
    bar.setAttribute('aria-label', 'Primary');
    bar.innerHTML = TABS.map(t => `
      <button class="tb-item" data-page="${t.page}" type="button" aria-label="${t.label}">
        <span class="tb-icon">${ICONS[t.glyph]}</span>
        <span class="tb-label">${t.label}</span>
      </button>
    `).join('') + `
      <button class="tb-fab" type="button" aria-label="Report a Disturbance" data-page="report">
        <span class="tb-fab-glyph">⚡</span>
        <span class="tb-fab-label">Report</span>
      </button>
    `;
    document.body.appendChild(bar);
    // Click handlers
    bar.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (window.showPage) window.showPage(page);
        haptic();
        syncTabActive(page);
      });
    });
    syncTabActive(getCurrentPage());
    // Listen for showPage navigations triggered elsewhere
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[onclick*="showPage"]');
      if (!navLink) return;
      const m = navLink.getAttribute('onclick').match(/showPage\(['"]([^'"]+)['"]\)/);
      if (m) setTimeout(() => syncTabActive(m[1]), 80);
    }, true);
  }

  function getCurrentPage() {
    const active = document.querySelector('.page.active, .page.is-active');
    if (active) return active.id.replace('page-', '');
    return 'home';
  }
  function syncTabActive(page) {
    const bar = document.getElementById('dlfi-tabbar');
    if (!bar) return;
    bar.querySelectorAll('.tb-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.page === page);
    });
  }

  // ============================================================
  // HAPTIC FEEDBACK — subtle vibration on button taps
  // ============================================================
  function haptic(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 10); } catch (e) {}
    }
  }
  // Wire on tappable elements (delegated)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [onclick], .case-card, .training-card, .quiz-card, .quiz-head, .choice, .profile-card, .story-card, .filter-btn, .nav-link, .tb-item, .tb-fab');
    if (t) haptic(10);
  }, true);
  window.dlfiHaptic = haptic;

  // ============================================================
  // FUNNY FILENAMES — wrap original exportSubs to use on-brand names
  // ============================================================
  // Replace the JSON export with one that uses fun receipt-themed names
  function buildFunFilename(count) {
    const adj = ['SEALED', 'CLASSIFIED', 'NOTARIZED', 'STAMPED', 'AUTHENTICATED', 'FILED-UNDER-PETTY'];
    const noun = ['BEAD-FILE', 'LACE-EVIDENCE', 'BEAD-BANDIT-RECEIPTS', 'WITNESS-REPORT', 'CHARGE-SHEET', 'COOKOUT-RECEIPTS'];
    const date = new Date().toISOString().slice(0,10);
    const a = adj[Math.floor(Math.random()*adj.length)];
    const n = noun[Math.floor(Math.random()*noun.length)];
    const c = (count != null) ? `-${count}-RECORDS` : '';
    return `DLFI-${n}-${a}${c}-${date}.json`;
  }
  window.dlfiFunFilename = buildFunFilename;

  // ============================================================
  // INSTALL APP — capture beforeinstallprompt for later manual use
  // (the recruit-page "ASSIGNMENT 0" card opens the on-brand pin modal)
  // ============================================================
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Don't auto-prompt — let the user trigger from the on-brand card
    syncPinCardState();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.documentElement.classList.add('dlfi-installed');
    syncPinCardState();
  });

  // Detect platform for the right instructions
  function detectPlatform() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    return { isIOS, isAndroid, isStandalone, isSafari, ua };
  }
  function syncPinCardState() {
    const card = document.getElementById('dlfi-pin-card');
    if (!card) return;
    const { isStandalone } = detectPlatform();
    card.classList.toggle('is-installed', isStandalone);
  }

  // ============================================================
  // PIN-TO-HOME MODAL — on-brand popup with motion graphics
  // ============================================================
  function buildPinModal() {
    if (document.getElementById('dlfi-pin-modal')) return;
    const m = document.createElement('div');
    m.id = 'dlfi-pin-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-labelledby', 'pn-title');
    m.innerHTML = `
      <div class="pn-box" role="document">
        <button class="pn-close" type="button" aria-label="Close"><span class="dc-x" aria-hidden="true">×</span><span class="dc-lbl">CLOSE</span></button>

        <div class="pn-scanline" aria-hidden="true"></div>

        <div class="pn-eyebrow"><span class="pn-eb-line"></span>FIELD KIT · CHANNEL 304 · ASSIGNMENT 0</div>
        <div class="pn-stamp">ON FILE</div>

        <h2 class="pn-title" id="pn-title">Save This Site To Your <em>Home Screen</em>.</h2>
        <div class="pn-script">Composure in your pocket. Receipts at thumb's reach.</div>

        <!-- Animated graphic: phone + descending pin + scanning ring -->
        <div class="pn-stage" aria-hidden="true">
          <div class="pn-rings"><span></span><span></span><span></span></div>
          <div class="pn-grid"></div>
          <svg class="pn-phone" viewBox="0 0 110 180" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="4" width="98" height="172" rx="16" ry="16" class="pn-phone-body"/>
            <rect x="12" y="22" width="86" height="138" class="pn-phone-screen"/>
            <line x1="42" y1="12" x2="56" y2="12" class="pn-phone-speaker"/>
            <circle cx="55" cy="168" r="4" class="pn-phone-home"/>
            <g class="pn-phone-app">
              <rect x="36" y="56" width="38" height="38" rx="8" ry="8" class="pn-app-tile"/>
              <text x="55" y="84" text-anchor="middle" class="pn-app-letter">D</text>
              <rect x="36" y="56" width="38" height="38" rx="8" ry="8" class="pn-app-tile-stroke"/>
            </g>
            <text x="55" y="112" text-anchor="middle" class="pn-app-label">DLFI</text>
          </svg>
          <div class="pn-pin">
            <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2 L22 8 L22 18 L26 22 L20 22 L20 36 L18 38 L16 36 L16 22 L6 22 L10 18 L10 8 Z"/>
            </svg>
          </div>
          <div class="pn-drop-shadow"></div>
        </div>

        <p class="pn-body">The Department does not beg. But if you're <span class="pink">serious about beadwork forensics</span>, you'll want one-tap access to your file room.</p>

        <!-- Platform-specific instructions (filled by JS) -->
        <div class="pn-steps" id="pn-steps"></div>

        <!-- Action row -->
        <div class="pn-actions" id="pn-actions"></div>

        <div class="pn-foot">Bookmarks are for amateurs. <span class="pink">Recruits pin.</span></div>
      </div>
    `;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => {
      if (e.target === m) closePinModal();
      if (e.target.closest('.pn-close')) closePinModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && m.classList.contains('is-on')) closePinModal();
    });
  }

  // Step icons
  const ICONS_PIN = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>',
    plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
    home:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><rect x="10" y="14" width="4" height="6"/></svg>',
    dots:  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>',
    bolt:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-2 8 11-13h-7z"/></svg>'
  };

  function renderSteps() {
    const { isIOS, isAndroid, isStandalone } = detectPlatform();
    const wrap = document.getElementById('pn-steps');
    if (!wrap) return;

    if (isStandalone) {
      wrap.innerHTML = `
        <div class="pn-installed">
          <span class="pn-inst-glyph">${ICONS_PIN.bolt}</span>
          <span><strong>You're already on the inside.</strong><br>DLFI is pinned. Composure achieved.</span>
        </div>`;
      return;
    }

    let steps = [];
    let label = '';
    if (isIOS) {
      label = 'IOS DOSSIER · 3 MOVES';
      steps = [
        { n: '01', g: ICONS_PIN.share, t: 'Tap the <strong>Share</strong> button at the bottom of Safari.' },
        { n: '02', g: ICONS_PIN.plus,  t: 'Scroll. Tap <strong>Add to Home Screen</strong>.' },
        { n: '03', g: ICONS_PIN.home,  t: 'Tap <strong>Add</strong>. The Department lands on your home screen.' }
      ];
    } else if (isAndroid) {
      label = 'ANDROID DOSSIER · 3 MOVES';
      steps = [
        { n: '01', g: ICONS_PIN.dots,    t: 'Open Chrome\'s menu — the <strong>three dots</strong>, top-right.' },
        { n: '02', g: ICONS_PIN.install, t: 'Tap <strong>Install app</strong> (or <em>Add to Home screen</em>).' },
        { n: '03', g: ICONS_PIN.home,    t: 'Confirm. DLFI lands on your home screen.' }
      ];
    } else {
      label = 'DESKTOP DOSSIER · OPTIONAL';
      steps = [
        { n: '01', g: ICONS_PIN.dots,    t: 'Open your browser menu (usually <strong>⋮</strong> top-right).' },
        { n: '02', g: ICONS_PIN.install, t: 'Choose <strong>Install DLFI</strong> or <em>Create shortcut</em>.' },
        { n: '03', g: ICONS_PIN.home,    t: 'DLFI lives on your dock. The receipts come with you.' }
      ];
    }

    wrap.innerHTML = `
      <div class="pn-steps-label">◆ ${label}</div>
      <ol class="pn-step-list">
        ${steps.map((s, i) => `
          <li class="pn-step" style="--i:${i};">
            <span class="pn-num">${s.n}</span>
            <span class="pn-glyph">${s.g}</span>
            <span class="pn-text">${s.t}</span>
          </li>`).join('')}
      </ol>`;
  }

  function renderActions() {
    const wrap = document.getElementById('pn-actions');
    if (!wrap) return;
    const { isStandalone } = detectPlatform();
    if (isStandalone) {
      wrap.innerHTML = `<button class="btn-outline pn-act-close" type="button"><span>Dismiss</span><span>×</span></button>`;
    } else if (deferredPrompt) {
      wrap.innerHTML = `
        <button class="btn-primary pn-act-execute" type="button"><span>⚡ Execute Install</span><span>↗</span></button>
        <button class="btn-outline pn-act-later" type="button"><span>I'll Do It Myself</span></button>
      `;
    } else {
      wrap.innerHTML = `
        <button class="btn-primary pn-act-close" type="button"><span>Affirmative. Pinning Now.</span><span>↗</span></button>
      `;
    }
    // Wire
    wrap.querySelectorAll('.pn-act-close, .pn-act-later').forEach(b => b.addEventListener('click', closePinModal));
    const exec = wrap.querySelector('.pn-act-execute');
    if (exec) exec.addEventListener('click', async () => {
      if (!deferredPrompt) { closePinModal(); return; }
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (e) {}
      deferredPrompt = null;
      closePinModal();
    });
  }

  function openPinModal() {
    buildPinModal();
    renderSteps();
    renderActions();
    const m = document.getElementById('dlfi-pin-modal');
    m.classList.add('is-on');
    document.body.classList.add('modal-open');
    haptic(15);
  }
  function closePinModal() {
    const m = document.getElementById('dlfi-pin-modal');
    if (m) m.classList.remove('is-on');
    document.body.classList.remove('modal-open');
  }
  window.dlfiPinPrompt = openPinModal;

  // Wire the in-page "Pin to Home Screen" assignment card on the recruit page
  function wirePinCard() {
    const card = document.getElementById('dlfi-pin-card');
    if (!card || card.dataset.wired) return;
    card.dataset.wired = '1';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.pn-card-cta') || e.target.closest('.pn-card-icon') || e.target.closest('.pn-card-title') || e.target === card || e.target.closest('.pn-card-stamp')) {
        openPinModal();
      } else {
        openPinModal();
      }
    });
    syncPinCardState();
  }

  // Init bottom tabs after DOM ready
  function init() {
    buildBottomTabs();
    // Page padding so content doesn't hide under bottom tab bar on phone
    document.body.classList.add('has-bottom-tabs');
    wirePinCard();
    syncPinCardState();
    // The pin card is added by HTML on the recruit page; if showPage swaps pages,
    // re-sync any state-dependent classes when it lands on the recruit page.
    document.addEventListener('click', (e) => {
      if (e.target.closest('[onclick*="showPage"]')) {
        setTimeout(() => { wirePinCard(); syncPinCardState(); }, 100);
      }
    }, true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
