// ============================================================
// DLFI v2 App — page nav, modals, motion, micro-interactions
// ============================================================

(function () {
  // Force audio default to ON every visit — clear any persisted off-pref.
  try { localStorage.removeItem('dlfi.audio.enabled'); } catch (e) {}
  try { localStorage.removeItem('dlfi.audio.userToggled'); } catch (e) {}

  const Audio = window.DLFIAudio;

  // ---------- CURSOR ----------
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  let curX = window.innerWidth / 2, curY = window.innerHeight / 2;
  let ringX = curX, ringY = curY;
  document.addEventListener('mousemove', (e) => {
    curX = e.clientX;
    curY = e.clientY;
    cursor.style.left = curX + 'px';
    cursor.style.top = curY + 'px';
  });
  (function animateRing() {
    ringX += (curX - ringX) * 0.18;
    ringY += (curY - ringY) * 0.18;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  })();

  // Cursor mode swaps
  document.addEventListener('mouseover', (e) => {
    const evidence = e.target.closest('[data-evidence]');
    if (evidence) ring.classList.add('crosshair');
    const interactive = e.target.closest('button, a, [onclick], .case-card, .resource-card, .story-card, .call-card, .profile-card, .ev-file-row, .tab-btn, .filter-btn, .form-input, .form-textarea, .form-select');
    if (interactive && !evidence) {
      ring.style.width = '28px';
      ring.style.height = '28px';
      ring.style.borderColor = 'var(--pink)';
      if (Audio && Math.random() < 0.4) Audio.hover();
    }
  });
  document.addEventListener('mouseout', (e) => {
    const evidence = e.target.closest('[data-evidence]');
    if (evidence) ring.classList.remove('crosshair');
    const interactive = e.target.closest('button, a, [onclick], .case-card, .resource-card, .story-card, .call-card, .profile-card, .ev-file-row, .tab-btn, .filter-btn, .form-input, .form-textarea, .form-select');
    if (interactive && !evidence) {
      ring.style.width = '36px';
      ring.style.height = '36px';
      ring.style.borderColor = '';
    }
  });

  // ---------- AUDIO TOGGLE ----------
  function syncAudioBtn(on) {
    const btn = document.getElementById('audioToggle');
    if (!btn) return;
    btn.setAttribute('data-on', on ? 'true' : 'false');
    const label = btn.querySelector('.lbl');
    if (label) label.textContent = on ? 'Audio: On' : 'Audio: Off';
  }

  function bindAudio() {
    const btn = document.getElementById('audioToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = Audio.toggle();
      syncAudioBtn(on);
      if (on) Audio.click();
    });

    // Default OFF. The Department is secretive — no auto-enable, no nudge.
    // Audio stays silent until the user explicitly clicks the audio toggle.
    syncAudioBtn(false);

    // Hide any legacy "Tap anywhere to enable sound" pulsing hint.
    const hint = document.getElementById('audioHint');
    if (hint) {
      hint.classList.add('is-dismissed');
      hint.style.display = 'none';
    }

    // Mute and pause the silent autoplay primer so nothing decodes in the
    // background. (It was warming up audio policy when audio was auto-on.)
    const primer = document.getElementById('audioPrimer');
    if (primer) {
      try { primer.muted = true; primer.volume = 0; primer.pause(); } catch (e) {}
    }
  }

  // ---------- PAGE NAV ----------
  window.showPage = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (!target) return;
    target.classList.add('active');

    document.querySelectorAll('.nav-links a, [id^="mnav-"]').forEach(a => a.classList.remove('active'));
    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');
    const mnavEl = document.getElementById('mnav-' + page);
    if (mnavEl) mnavEl.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (Audio) Audio.pageEnter();
    if (Audio) Audio.click();

    // Re-run reveal observer for new page
    setTimeout(() => observeReveals(target), 50);

    // Update URL hash for shareability
    history.replaceState(null, '', '#' + page);
  };

  // ---------- HAMBURGER ----------
  window.toggleMenu = function () {
    const menu = document.getElementById('mobileMenu');
    const ham = document.getElementById('hamburger');
    menu.classList.toggle('open');
    ham.classList.toggle('open');
    if (Audio) Audio.click();
  };

  // ---------- CASE MODAL ----------
  window.openCaseFromEl = function (el) {
    try {
      const raw = el.dataset.case;
      if (!raw) return;
      const decoded = raw.replace(/&#39;/g, "'");
      const data = JSON.parse(decoded);
      // Evidence HTML didn't survive the source-extraction regex, so clone
      // the source card's already-rendered evidence child instead.
      const evSrc = el.querySelector('.ev-photo, .ev-surveillance, .ev-polaroid, .ev-dossier, .ev-mugshot, .ev-glamour');
      if (evSrc) {
        const clone = evSrc.cloneNode(true);
        // Strip the corner charge-badge (modal has its own type badge)
        clone.querySelectorAll('.charge-badge').forEach(n => n.remove());
        // Inside the modal preview we use a calmer, non-glitching CLASSIFIED stamp
        // so the text reads clearly at the larger size.
        clone.classList.add('in-modal');
        data.evidence = clone.outerHTML;
      }
      window.openCaseModal(data);
    } catch (e) {
      console.error('openCaseFromEl failed:', e);
    }
  };
  window.openCaseModal = function (data) {
    const m = document.getElementById('caseModal');
    if (!m) return;
    document.getElementById('m-title').textContent = data.title || '';
    document.getElementById('m-narrative').textContent = data.narrative || '';
    document.getElementById('m-charge').textContent = data.charge || '';
    document.getElementById('m-location').textContent = data.location || '';
    document.getElementById('m-status').textContent = data.status || '';
    document.getElementById('m-type').textContent = data.type || '';
    document.getElementById('m-num').textContent = data.num || '';
    document.getElementById('m-evidence').innerHTML = data.evidence || '';
    const sus = document.getElementById('m-suspect');
    if (sus) sus.textContent = data.suspect || 'Unknown — at large';
    m.classList.add('open');
    if (Audio) { Audio.dossierOpen(); setTimeout(() => Audio.stamp(), 350); }
  };
  window.closeCaseModal = function () {
    document.getElementById('caseModal').classList.remove('open');
    if (Audio) Audio.click();
  };

  // Story modal
  window.openStoryModal = function () {
    document.getElementById('storyModal').classList.add('open');
    if (Audio) Audio.dossierOpen();
  };
  window.closeStoryModal = function () {
    document.getElementById('storyModal').classList.remove('open');
    if (Audio) Audio.click();
  };

  // Generic overlay-click close
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
      if (Audio) Audio.click();
    }
  });

  // ESC closes all modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // ---------- FILTER ----------
  window.filterCases = function (type, btn) {
    document.querySelectorAll('#cases-grid .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const cards = document.querySelectorAll('.case-card[data-type]');
    cards.forEach((c, i) => {
      const matches = type === 'all' || c.dataset.type === type;
      c.style.transition = 'opacity 0.4s, transform 0.4s';
      if (matches) {
        c.style.display = '';
        setTimeout(() => {
          c.style.opacity = '1';
          c.style.transform = 'translateY(0) scale(1)';
        }, i * 30);
      } else {
        c.style.opacity = '0';
        c.style.transform = 'translateY(8px) scale(0.96)';
        setTimeout(() => { c.style.display = 'none'; }, 350);
      }
    });
    if (Audio) Audio.click();
  };

  // ---------- SORT ----------
  window.sortCases = function (key) {
    const grid = document.querySelector('#cases-grid .grid-4');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.case-card[data-type]'));
    // Aliases — UI uses "disturbing" but attribute is `data-disturb`
    const ALIASES = { disturbing: 'disturb' };
    const attr = 'data-' + (ALIASES[key] || key);
    cards.sort((a, b) => {
      const av = parseFloat(a.getAttribute(attr)) || 0;
      const bv = parseFloat(b.getAttribute(attr)) || 0;
      return bv - av;
    });
    // Fade out, reorder, fade in
    cards.forEach(c => { c.style.transition = 'opacity 0.25s'; c.style.opacity = '0.2'; });
    setTimeout(() => {
      cards.forEach(c => grid.appendChild(c));
      cards.forEach((c, i) => {
        setTimeout(() => { c.style.opacity = '1'; }, i * 35);
      });
    }, 220);
    if (Audio) Audio.click();
  };

  // Resources tabs
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-btn');
    if (tab) {
      const bar = tab.parentElement;
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      if (Audio) Audio.click();
    }
  });

  // ---------- EVIDENCE ROOM DIARY ----------
  const DIARIES = {
    'bathroom-heist': {
      caseNum: 'CASE Nº T-063',
      title: 'The Bathroom <span class="italic">Hair Heist</span>',
      date: 'Tuesday · 11:47 PM',
      by: 'Anonymous · Subject T',
      mood: 'Mid-rinse and unbothered',
      paragraphs: [
        "Dear Department, I was rinsing the second round of conditioner out of my hair when she walked in like she'd been waiting for the cue. I saw the towel in her hand and I saw the look in her eye. Two different agendas in one bathroom.",
        "She reached. I tilted. The conditioner did what conditioner does — it moved my hair through her fingers like silk through a sieve. She walked out with nothing but the smell of shea butter on her wrist and a renewed understanding of slip.",
        "I rinsed. I deep-conditioned again. I lit a candle. The Department was notified at 12:04 AM."
      ],
      lesson: 'Some people need moisturizer and therapy. The good news is one of those is on aisle 7.'
    },
    'transferable': {
      caseNum: 'CASE Nº 1B-530',
      title: 'She Thought My Hair Was <span class="italic">Transferable</span>',
      date: 'Sunday · 2:13 PM',
      by: 'Anonymous · Subject 1B',
      mood: 'Composed. Filing receipts.',
      paragraphs: [
        "Dear Department, he showed up to the function with hands that have clearly been touching MY hair texture on someone else's head. I noticed. I did not say. I noticed twice. I still did not say.",
        "She was operating on the premise that proximity to him would make my DNA suddenly available for installation. The Department politely informs the suspect: that is not how DNA works. That is not how anything works.",
        "He has been quietly returned to his original packaging. I have not been answering his texts. The hair remains, as ever, factory-installed."
      ],
      lesson: 'DNA still not available for download. Buy your own.'
    },
    'remake': {
      caseNum: 'CASE Nº F-26/27',
      title: 'She Copied My <span class="italic">Whole Personality</span>',
      date: 'Friday · 9:02 PM',
      by: 'Anonymous · Subject F',
      mood: 'Mildly amused. Heavily armed.',
      paragraphs: [
        "Dear Department, the imitation began with the part. Then the parted hair. Then the captions. Then — and this is the part I want logged — she started using my nickname. The one only two people in this city call me. One of them is my mama.",
        "I attempted nothing. I corrected nothing. I simply continued to be the original at a pace she could not keep up with. Within four months, her wardrobe pivoted entirely. Within six, she had a new accent.",
        "She is currently on Draft 3 of being me. The Department reminds all field operatives: imitation is not flattery. Imitation is a confession."
      ],
      lesson: "I'm the blueprint. You're just the remake."
    },
    'edge-assassination': {
      caseNum: 'CASE Nº 2005',
      title: 'The Edge <span class="italic">Assassination</span>',
      date: 'Monday · 7:30 AM',
      by: 'Anonymous · Subject 20',
      mood: 'Holding court.',
      paragraphs: [
        "Dear Department, my mousse was found upturned and used. I store it in a specific spot. The spot was disturbed. The brush was used in the wrong direction. The lid was not screwed back on. Three separate crimes.",
        "She did not ask. She did not refill. She did not even close the cap. I said nothing. I simply began wearing my curls differently in her presence so she had nothing to study.",
        "Within three weeks, her edges started receding on schedule. I did not gloat. The Department does not gloat. The Department documents."
      ],
      lesson: 'Touch my products, lose your edges. Fair is fair.'
    },
    'group-chat': {
      caseNum: 'CASE Nº A-023',
      title: 'My Man. <span class="italic">Her Group Chat.</span>',
      date: 'Wednesday · Late',
      by: 'Anonymous · Subject A',
      mood: 'Mildly entertained.',
      paragraphs: [
        "Dear Department, the group chat had three of them. Each one took a turn. They thought he was being passed around. He was being processed.",
        "He came back to me with two stories that didn't match, one new cologne he didn't pick out, and a sudden interest in scripture. I let him talk. I let him keep talking.",
        "I did not ask their names. I did not need to. He returned to his original packaging within ninety days. They are now all single, all subscribed to my page, and all curiously quiet."
      ],
      lesson: 'Birds of a feather weep together. Subscribe to her — she filed first.'
    },
    'formula': {
      caseNum: 'CASE Nº T-106',
      title: 'She Wanted My <span class="italic">Exact Formula</span>',
      date: 'Saturday · 4:15 PM',
      by: 'Anonymous · Subject T',
      mood: 'Soft. Lethal. Moisturized.',
      paragraphs: [
        "Dear Department, she pulled me aside at the function and asked, with the tone of someone trying not to seem desperate, what I 'use'. The Department permits a generic answer.",
        "I told her 'water'. She nodded. She said 'water' back to me, like a spell. She did not laugh. She wrote it down.",
        "Three weeks later her hair was, by all reasonable observation, not doing well. The Department reminds the public: the formula is the bloodline. You cannot copy a bloodline at Target."
      ],
      lesson: "You can't copy realness. Not from me. Not from anyone."
    }
  };

  window.openDiary = function (key) {
    const d = DIARIES[key];
    if (!d) return;
    document.getElementById('diaryCaseNum').textContent = d.caseNum;
    document.getElementById('diaryStamp').textContent = 'DIARY ENTRY · SEALED FOR REVIEW';
    document.getElementById('diaryTitle').innerHTML = d.title;
    document.getElementById('diaryDate').textContent = d.date;
    document.getElementById('diaryBy').textContent = d.by;
    document.getElementById('diaryMood').textContent = d.mood;
    document.getElementById('diaryBody').innerHTML = d.paragraphs.map(p => `<p>${p}</p>`).join('');
    document.getElementById('diaryLesson').textContent = d.lesson;
    document.getElementById('diaryModal').classList.add('open');
    if (Audio) Audio.dossierOpen();
  };

  // ---------- DEPARTMENT BIOS ----------
  const BIOS = {
    chief: {
      img: 'img/chief-investigator-portrait.png',
      agent: 'DLFI / 001',
      clear: 'A-1',
      rank: 'Chief Investigator',
      name: 'Unapologetic Exotical',
      codename: 'The Founder',
      specialty: 'Composure · Receipts · Final Word',
      story: [
        "Founded the Department after one too many bead bandits tried to dim her shine in a group setting. They thought they were running a quiet campaign. They were running their mouths.",
        "She did not engage. She did not explain. She collected — quietly, daily, for years. When the receipts had names on them, she made them a building. The building is DLFI.",
        "Composure is her weapon. Documentation is her vocabulary. Empire is the side effect."
      ],
      quote: 'They tried to bury me under receipts. I used them to build my empire.'
    },
    receipts: {
      img: 'img/agent-01.png',
      agent: 'AGT-002',
      clear: 'A-2',
      rank: 'Head of Receipts',
      name: 'Evidence Collector',
      codename: 'The Archive',
      specialty: 'Screenshot retention · Cross-referencing · Paper trails',
      story: [
        "Joined DLFI after the bead bandits made jokes about her glow-up at a baby shower and then borrowed her edge control without asking. She did not say a word. She started screenshotting.",
        "Three years later, she runs the largest receipt archive in the Department — twelve binders, cloud-backed, color-coded. If it happened on a screen, she has it. If it was whispered, she has the witness statement.",
        "She joined to make sure no bullying moment ever again gets to disappear without a trace. The bead bandits learned. Slowly."
      ],
      quote: 'If it happened, I got the proof.'
    },
    surveillance: {
      img: 'img/agent-02.png',
      agent: 'AGT-003',
      clear: 'A-3',
      rank: 'Surveillance Queen',
      name: 'Eyes On Everything',
      codename: 'Stillwater',
      specialty: 'Reading the room · Posture analysis · Tone detection',
      story: [
        "Watched the bead bandits whisper about her in middle school, again in high school, again at her cousin's birthday. They kept slipping. She kept noticing.",
        "Now she sits in any room and reads the energy before the first sentence lands. She has clocked three group-chat plots in real time and one entire wedding-aisle scheme before the bride finished her vows.",
        "She joined DLFI because she got tired of pretending she didn't see what she clearly saw."
      ],
      quote: "You breathe, I'm probably watching."
    },
    forensics: {
      img: 'img/agent-04.png',
      agent: 'AGT-004',
      clear: 'A-4',
      rank: 'Digital Forensics',
      name: 'Data Doesn\'t Lie',
      codename: 'Rewind',
      specialty: 'Deleted DMs · Recovered drafts · Metadata',
      story: [
        "Was the quiet one in every group chat until the bead bandits screenshotted half a sentence she said out of context and ran with it. They forgot she does this for a living.",
        "She pulled the full thread, the unsent drafts, the edited photo originals, and the timestamps. She didn't post any of it. She gave it to DLFI.",
        "She joined because deleted does not mean gone, and pretending innocence does not survive a real audit."
      ],
      quote: "I recover more than just files."
    },
    interrogation: {
      img: 'img/agent-05.png',
      agent: 'AGT-005',
      clear: 'L-5',
      rank: 'Interrogation Lead',
      name: 'The Truth Teller',
      codename: 'Quiet Room',
      specialty: 'Silence as pressure · The well-placed question · Posture',
      story: [
        "The bead bandits used to corner her in bathrooms at school, asking loud questions designed to humiliate her in front of the audience they pre-assembled. She answered politely. Each time, with less. Then with nothing.",
        "She discovered that silence, deployed correctly, is louder than any clapback. The bandits started avoiding her. The Department recruited her on the spot.",
        "She joined because she's done explaining herself to people who already know the answer."
      ],
      quote: "I don't raise my voice. I raise receipts."
    },
    strategy: {
      img: 'img/agent-06.png',
      agent: 'AGT-006',
      clear: 'L-6',
      rank: 'Strategy Architect',
      name: 'The Planner',
      codename: 'Three Moves',
      specialty: 'Long games · Bandit pattern mapping · Counter-moves',
      story: [
        "Spent years watching the bead bandits run the same play on three different girls in three different schools. They thought variety came from changing the target. The Architect knew the script was identical.",
        "She mapped every move, every alibi, every borrowed catchphrase. By the time the bandits tried it on her, she had the entire board. She did not flip it — she let them play themselves into a corner.",
        "She joined DLFI to teach the next generation that patience is a weapon when patience comes with a notebook."
      ],
      quote: "We plan. You pause."
    },
    chaos: {
      img: 'img/agent-03.png',
      agent: 'AGT-007',
      clear: 'L-7',
      rank: 'Chaos Coordinator',
      name: 'Disruption By Design',
      codename: 'Confetti',
      specialty: 'Public reveals · Tonal control · The exit',
      story: [
        "The bead bandits made her birthday party a referendum on what she was wearing. She did not leave the party. She did not raise her voice. She simply rearranged the seating chart, the music, and the conversation, and watched them lose their footing in real time.",
        "Within an hour, the audience they had assembled had quietly switched sides. Without one word being raised. Just a perfectly-timed playlist change.",
        "She joined DLFI because the bandits needed to learn that chaos belongs to whoever stays composed inside it."
      ],
      quote: "I call it art."
    }
  };

  window.openBio = function (key) {
    const b = BIOS[key];
    if (!b) return;
    document.getElementById('bioImg').src = b.img;
    document.getElementById('bioImg').alt = b.name;
    document.getElementById('bioAgent').textContent = b.agent;
    document.getElementById('bioStamp').textContent = 'PERSONNEL FILE · SEALED FOR REVIEW';
    document.getElementById('bioBadgeId').textContent = b.agent;
    document.getElementById('bioBadgeClear').textContent = 'CLEAR ' + b.clear;
    document.getElementById('bioRank').textContent = b.rank;
    document.getElementById('bioName').textContent = b.name;
    document.getElementById('bioCodename').textContent = b.codename;
    document.getElementById('bioSpecialty').textContent = b.specialty;
    document.getElementById('bioBody').innerHTML = b.story.map(p => `<p>${p}</p>`).join('');
    document.getElementById('bioQuote').textContent = '"' + b.quote + '"';
    document.getElementById('bioModal').classList.add('open');
    if (Audio) Audio.dossierOpen();
  };

  // ---------- REPORT FORM ----------
  function generateReceiptId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 3; i++) s += chars[Math.floor(Math.random()*chars.length)];
    const n1 = String(Math.floor(Math.random()*9000)+1000);
    const n2 = String(Math.floor(Math.random()*900)+100);
    return `${s}-${n1}-${n2}`;
  }
  function nowUTCHHMM() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  function showReceivedModal() {
    const idEl = document.getElementById('reportReceiptId');
    const timeEl = document.getElementById('reportTime');
    if (idEl) idEl.textContent = generateReceiptId();
    if (timeEl) timeEl.textContent = nowUTCHHMM();
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.add('open');
    if (Audio) { Audio.stamp(); setTimeout(() => Audio.unlockTick && Audio.unlockTick(), 200); }
  }

  window.submitReport = function (ev) {
    if (ev) ev.preventDefault();
    const btn = document.getElementById('submitBtn');
    const form = (ev && ev.target && ev.target.closest('form')) || document.querySelector('#page-report form');
    if (btn) {
      btn.classList.add('loading');
      btn.querySelector('.btn-label').textContent = 'Filing Report...';
    }
    let step = 0;
    const steps = ['Encrypting Report...', 'Routing to Field Office...', 'Logging to Database...', 'Report Filed.'];
    const interval = setInterval(() => {
      step++;
      if (btn && step < steps.length) {
        btn.querySelector('.btn-label').textContent = steps[step];
      }
      if (step >= steps.length - 1) {
        clearInterval(interval);
        // Persist the submission + send via Netlify Forms (handled by dlfi-extras.js)
        const result = window.dlfiSaveSubmission ? window.dlfiSaveSubmission('report', form) : { ok: true };
        if (result && result.ok === false) {
          if (btn) {
            btn.classList.remove('loading');
            btn.querySelector('.btn-label').textContent = 'Submit Report';
          }
          if (window.dlfiBlockedModal) window.dlfiBlockedModal(result);
          else alert('Submission blocked.');
          return;
        }
        setTimeout(() => {
          showReceivedModal();
          if (form) form.reset();
          if (btn) {
            btn.classList.remove('loading');
            btn.querySelector('.btn-label').textContent = 'Submit Report';
          }
        }, 500);
      }
    }, 600);
  };

  // Story Submit (from home page)
  window.submitStory = function (ev) {
    if (ev) ev.preventDefault();
    const btn = document.getElementById('storySubmitBtn');
    const form = document.getElementById('storyModal');
    if (btn) {
      btn.classList.add('loading');
      const lab = btn.querySelector('.btn-label');
      if (lab) lab.textContent = 'Filing Evidence...';
    }
    const result = window.dlfiSaveSubmission ? window.dlfiSaveSubmission('story', form) : { ok: true };
    if (result && result.ok === false) {
      if (btn) {
        btn.classList.remove('loading');
        const lab = btn.querySelector('.btn-label');
        if (lab) lab.textContent = 'Submit Evidence';
      }
      if (window.dlfiBlockedModal) window.dlfiBlockedModal(result);
      else alert('Submission blocked.');
      return;
    }
    setTimeout(() => {
      const storyModal = document.getElementById('storyModal');
      if (storyModal) {
        storyModal.classList.remove('open');
        storyModal.querySelectorAll('input, textarea').forEach(el => el.value = '');
      }
      if (btn) {
        btn.classList.remove('loading');
        const lab = btn.querySelector('.btn-label');
        if (lab) lab.textContent = 'Submit Evidence';
      }
      setTimeout(showReceivedModal, 300);
    }, 1200);
  };

  // YouTube channel — break out of any iframe sandbox and open in a new window/tab
  window.openYouTubeChannel = function (ev) {
    if (ev) ev.preventDefault();
    const url = 'https://www.youtube.com/@UnapologeticExotical';
    // try opening in a new top-level window first (works for users with real browsers)
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      // Fall back to top-frame navigation (escapes iframe sandbox in preview)
      try { window.top.location.href = url; }
      catch (e) { window.location.href = url; }
    }
    if (Audio) Audio.click();
  };

  // ---------- SCROLL REVEAL ----------
  function observeReveals(scope) {
    const root = scope || document;
    const els = root.querySelectorAll('[data-reveal], [data-reveal-stagger]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target.hasAttribute('data-reveal-stagger')) {
            const kids = entry.target.children;
            Array.from(kids).forEach((k, i) => {
              k.style.transitionDelay = (i * 70) + 'ms';
            });
          }
          entry.target.classList.add('revealed');
          // Stat tile fill
          if (entry.target.classList.contains('stat-tile')) {
            entry.target.classList.add('visible');
          }
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => obs.observe(el));

    // Also observe stat tiles for the bar fill
    root.querySelectorAll('.stat-tile').forEach(el => obs.observe(el));
  }

  // ---------- COUNT UP STATS ----------
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const start = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = target * eased;
      el.innerHTML = (target >= 1000 ? Math.round(cur).toLocaleString() : Math.round(cur)) + (suffix ? `<span class="stat-suffix">${suffix}</span>` : '');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function observeCounts() {
    const els = document.querySelectorAll('[data-count]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(el => obs.observe(el));
  }

  // ---------- TYPED INTRO (hotline) ----------
  function typeText(el, text, speed = 60) {
    el.textContent = '';
    const caret = document.createElement('span');
    caret.className = 'typed-cursor';
    el.appendChild(caret);
    let i = 0;
    const id = setInterval(() => {
      if (i >= text.length) { clearInterval(id); return; }
      caret.insertAdjacentText('beforebegin', text.charAt(i));
      i++;
    }, speed);
  }
  function observeTyped() {
    document.querySelectorAll('[data-typed]').forEach(el => {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            typeText(el, el.dataset.typed, parseInt(el.dataset.speed || '60', 10));
            obs.disconnect();
          }
        });
      }, { threshold: 0.4 });
      obs.observe(el);
    });
  }

  // ---------- LIVE CLOCK (UTC status bar) ----------
  function startClock() {
    const el = document.getElementById('utcClock');
    const hf = document.getElementById('hfTs');
    function tick() {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      const t = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
      if (el) el.textContent = t + ' UTC';
      if (hf) hf.textContent = t;
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---------- INIT ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (Audio) Audio.restore();
    bindAudio();
    startClock();
    observeReveals();
    observeCounts();
    observeTyped();

    // Handle hash on load
    const hash = (location.hash || '#home').slice(1);
    if (document.getElementById('page-' + hash)) {
      window.showPage(hash);
    }
  });
})();
