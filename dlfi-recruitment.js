// DLFI Recruitment / Training quiz logic.
// Tracks score in localStorage so reload preserves progress.
(function () {
  'use strict';

  const STORAGE_KEY = 'dlfi-recruit-v1';
  const RANKS = [
    'Trainee Observer',
    'Receipt Collector',
    'Certified Lace Tearer Analyst',
    'Emotional Intelligence Specialist',
    'Lace Tearer',
    'Lace Tearer In Chief'
  ];
  // Score required to reach each rank index (0-based)
  const RANK_THRESHOLDS = [0, 1, 2, 3, 4, 5];

  // Load state
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      return Object.assign(defaults(), s);
    } catch (e) { return defaults(); }
  }
  function defaults() {
    return {
      answered: {},   // {qid: 'A'|'B'|'C'|'D'} — only correct answers retained for scoring
      score: 0,
      rankIdx: 0,
      stats: {
        observation: 22,
        receipt: 18,
        verbal: 25,
        psych: 30,
        emotional: 27
      }
    };
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function pctClamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  // Compute rank from score
  function rankFromScore(score) {
    let idx = 0;
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
      if (score >= RANK_THRESHOLDS[i]) idx = i;
    }
    return idx;
  }

  // Update the recruit-card + ladder + stats display
  function render(state) {
    // Current rank
    const rank = RANKS[state.rankIdx];
    const cur = document.querySelector('.recruit-card .rc-current-rank .nm');
    if (cur) cur.textContent = rank;

    // Rank ladder
    document.querySelectorAll('.rank-ladder .rank-step').forEach((step, i) => {
      step.classList.remove('is-current', 'is-locked');
      if (i === state.rankIdx) step.classList.add('is-current');
      else if (i > state.rankIdx) step.classList.add('is-locked');
    });

    // Stats
    Object.entries(state.stats).forEach(([key, val]) => {
      const tile = document.querySelector(`.rs-tile[data-key="${key}"]`);
      if (!tile) return;
      const num = tile.querySelector('.rs-val .rs-num-v');
      const bar = tile.querySelector('.rs-bar > i');
      if (num) num.textContent = pctClamp(val);
      if (bar) bar.style.right = (100 - pctClamp(val)) + '%';
    });

    // Score meter
    const total = document.querySelectorAll('.quiz-card').length;
    const ans = state.score;
    const meterBar = document.querySelector('.quiz-meter .qm-bar > i');
    const meterNum = document.querySelector('.quiz-meter .qm-num-v');
    const meterDen = document.querySelector('.quiz-meter .qm-num-d');
    if (meterBar) meterBar.style.right = (100 - (ans/total)*100) + '%';
    if (meterNum) meterNum.textContent = ans;
    if (meterDen) meterDen.textContent = total;

    // Restore answered questions visual state
    Object.entries(state.answered).forEach(([qid, picked]) => {
      const card = document.querySelector(`.quiz-card[data-qid="${qid}"]`);
      if (!card) return;
      const correct = card.dataset.answer;
      card.classList.add(picked === correct ? 'is-correct' : 'is-wrong');
      card.querySelectorAll('.choice').forEach(ch => {
        ch.classList.add('is-disabled');
        if (ch.dataset.letter === correct) ch.classList.add('is-correct');
        else if (ch.dataset.letter === picked) ch.classList.add('is-wrong');
      });
      const statusEl = card.querySelector('.qh-status');
      if (statusEl) statusEl.textContent = picked === correct ? 'CORRECT · ARCHIVED' : 'INCORRECT · NOTED';
      const verdict = card.querySelector('.quiz-verdict');
      if (verdict) verdict.classList.add(picked === correct ? 'is-correct' : 'is-wrong');
    });
  }

  // ---- Quiz interactions ----
  function bindCards() {
    document.querySelectorAll('.quiz-card').forEach(card => {
      const head = card.querySelector('.quiz-head');
      if (head) head.addEventListener('click', (e) => {
        // Don't toggle if clicking a choice button
        if (e.target.closest('.choice')) return;
        card.classList.toggle('is-open');
      });

      card.querySelectorAll('.choice').forEach(ch => {
        ch.addEventListener('click', () => onAnswer(card, ch));
      });
    });
  }

  function onAnswer(card, choiceEl) {
    const state = loadState();
    const qid = card.dataset.qid;
    if (state.answered[qid]) return; // already answered
    const picked = choiceEl.dataset.letter;
    const correct = card.dataset.answer;
    const isRight = picked === correct;
    state.answered[qid] = picked;
    if (isRight) state.score = Math.min(RANKS.length - 1, state.score + 1);

    // Bump some stats randomly to feel rewarding
    const bumps = isRight
      ? { observation: 8, receipt: 6, verbal: 7, psych: 9, emotional: 8 }
      : { observation: 3, receipt: 2, verbal: 2, psych: 4, emotional: 3 };
    Object.keys(bumps).forEach(k => {
      state.stats[k] = pctClamp(state.stats[k] + bumps[k] + (isRight ? Math.random()*4 : Math.random()*2));
    });

    // Check rank up
    const newRank = rankFromScore(state.score);
    const promoted = newRank > state.rankIdx;
    state.rankIdx = newRank;
    saveState(state);

    // Visual flash on choices
    card.querySelectorAll('.choice').forEach(c => {
      c.classList.add('is-disabled');
      if (c.dataset.letter === correct) c.classList.add('is-correct');
      else if (c === choiceEl && !isRight) c.classList.add('is-wrong');
    });

    // Set status
    const statusEl = card.querySelector('.qh-status');
    if (statusEl) statusEl.textContent = isRight ? 'CORRECT · ARCHIVED' : 'INCORRECT · NOTED';
    card.classList.add(isRight ? 'is-correct' : 'is-wrong');

    // Verdict line
    const verdict = card.querySelector('.quiz-verdict');
    if (verdict) verdict.classList.add(isRight ? 'is-correct' : 'is-wrong');

    render(state);

    if (promoted) {
      showPromotion(RANKS[newRank], state.score);
    }
  }

  function showPromotion(rankName, score) {
    const modal = document.getElementById('promotion-modal');
    if (!modal) return;
    modal.querySelector('.pm-rank .nm').textContent = rankName;
    modal.querySelector('.pm-score').textContent = score + '/5';
    modal.classList.add('is-on');
  }

  function closePromotion() {
    const modal = document.getElementById('promotion-modal');
    if (modal) modal.classList.remove('is-on');
  }

  function resetProgress() {
    const reset = () => {
      localStorage.removeItem(STORAGE_KEY);
      document.querySelectorAll('.quiz-card').forEach(card => {
        card.classList.remove('is-open', 'is-correct', 'is-wrong');
        const status = card.querySelector('.qh-status');
        if (status) status.textContent = 'PENDING';
        card.querySelectorAll('.choice').forEach(c => c.classList.remove('is-correct', 'is-wrong', 'is-disabled'));
        const verdict = card.querySelector('.quiz-verdict');
        if (verdict) verdict.classList.remove('is-correct', 'is-wrong');
      });
      render(loadState());
      if (window.DLFIAudio && window.DLFIAudio.click) window.DLFIAudio.click();
    };
    if (window.dlfiConfirm) {
      window.dlfiConfirm({
        stamp: 'HOLD UP',
        title: 'Reset Training?',
        body: 'You must be a <span style="color:var(--pink);">bead bandit trying to lie to kick it</span>.<br>Try again.<br><br>If you really want to wipe your rank and answers, confirm below.',
        ok: 'Wipe Training',
        cancel: 'Keep My Receipts'
      }, reset);
    } else {
      // Fallback if extras.js failed to load
      if (confirm('Reset training progress?')) reset();
    }
  }

  function init() {
    if (!document.querySelector('.quiz-card')) return;
    bindCards();
    bindModules();
    render(loadState());
    const closeBtn = document.querySelector('#promotion-modal .pm-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePromotion);
    const resetBtn = document.getElementById('recruit-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetProgress);
  }

  // ---- Training-module modal ----
  const MODULES = {
    'MOD-01': {
      doctrine: "If you can be observed without observing, you have already lost the moment.",
      attr: "DLFI · Field Manual",
      method: "What to actually watch:",
      points: [
        "<strong>Tone latency</strong> — the half-second pause before someone answers. That's where the truth lives.",
        "<strong>Micro-expressions</strong> — the eyes betray what the mouth rehearses.",
        "<strong>Posture pivots</strong> — when she straightens her back to talk to certain people only.",
        "<strong>Audience checks</strong> — does she look for approval before she finishes the sentence?",
        "<strong>The wave</strong> — friendly to your face, blank to your back."
      ],
      quotes: [
        ["The compliment that arrives with a tilted head is rarely a compliment.", "Recruit Handbook · §2.1"],
        ["Surveillance is not staring. It is staying composed while she gives herself away.", "Lace Tearer Doctrine"]
      ]
    },
    'MOD-02': {
      doctrine: "Receipts don't need to be loud. They need to be timestamped.",
      attr: "DLFI · Archival Protocol",
      method: "Standard archival kit:",
      points: [
        "<strong>Screenshot first, respond never</strong> — the response is the file, not the reply.",
        "<strong>Three-point capture</strong> — original message, surrounding thread, the date stamp.",
        "<strong>Cross-reference folder</strong> — group receipts by person, not by feeling.",
        "<strong>Cloud, not phone</strong> — receipts you can lose aren't receipts.",
        "<strong>Never confront. Only catalogue.</strong> The folder is the closing argument."
      ],
      quotes: [
        ["A receipt is a quiet sentence. Let it speak when she expects an apology.", "Field Manual 02"],
        ["She'll forget what she said. Your archive will not.", "Recruit Doctrine"]
      ]
    },
    'MOD-03': {
      doctrine: "Volume is not power. The pause is.",
      attr: "DLFI · Verbal Defense",
      method: "Approved responses, by scenario:",
      points: [
        "<strong>Disrespect dressed as a question</strong> → <em>'I'm not sure why you'd ask that.'</em> Then silence.",
        "<strong>Public bait</strong> → eye contact. No words. Walk on.",
        "<strong>Triangulation attempt</strong> → <em>'You'd have to ask her.'</em>",
        "<strong>Faux concern</strong> → <em>'I'm well, thank you for thinking of me.'</em>",
        "<strong>The unprompted opinion</strong> → <em>'Was that for me?'</em> — said calmly, once."
      ],
      quotes: [
        ["The clapback is rookie work. The composed sentence is bureau standard.", "Lace Tearer In Chief"],
        ["Silence, deployed correctly, is a verbal weapon.", "Field Manual 03"]
      ]
    },
    'MOD-04': {
      doctrine: "You don't have to win the room. You only have to leave it intact.",
      attr: "DLFI · Composure Doctrine",
      method: "Held posture, under fire:",
      points: [
        "<strong>Shoulders soft, jaw relaxed</strong> — tension is what they came for.",
        "<strong>Breath through the nose</strong> — it controls the next sentence before you do.",
        "<strong>Two-blink rule</strong> — when surprised, blink twice and continue. Never flinch.",
        "<strong>The half-smile</strong> — used sparingly, it ends arguments without one.",
        "<strong>Leave first</strong> — but only when YOU decide it's time."
      ],
      quotes: [
        ["She is loud because she has nothing left. You are quiet because you have everything.", "Recruit Bible"],
        ["Composure is a weapon disguised as good manners.", "DLFI Motto"]
      ]
    },
    'MOD-05': {
      doctrine: "Once is a moment. Twice is a pattern. Three times is a confession.",
      attr: "DLFI · Pattern Analysis",
      method: "Pattern triggers to watch for:",
      points: [
        "<strong>Repeated micro-jabs</strong> wrapped in jokes — the joke is the alibi.",
        "<strong>Recurring 'forgetting' to invite you</strong> while remembering everyone else.",
        "<strong>Selective curiosity</strong> — asking only the questions designed to make you defend yourself.",
        "<strong>Identical script, different audience</strong> — she's run this line before.",
        "<strong>Public love, private silence.</strong> Notice who shows up when no one is watching."
      ],
      quotes: [
        ["Patterns don't lie. People perform.", "Field Manual 05"],
        ["When the same thing happens twice, it's not a coincidence — it's a draft.", "Lace Tearer Notes"]
      ]
    },
    'MOD-06': {
      doctrine: "Weird energy is information. Don't argue with it. File it.",
      attr: "DLFI · Atmospheric Reading",
      method: "Atmospheric tells:",
      points: [
        "<strong>The room hush</strong> — conversation drops a half-tone when you walk in. Note who shifted.",
        "<strong>The look-away</strong> — when she pretends not to see you while clearly seeing you.",
        "<strong>Pre-prepared laughter</strong> — too quick, too coordinated, too loud.",
        "<strong>Sudden generosity</strong> — sometimes a gift is a flag.",
        "<strong>The vibe is rarely wrong, and never accidental.</strong>"
      ],
      quotes: [
        ["Your intuition isn't paranoid. It's been on the job longer than you have.", "Recruit Handbook · §6.4"],
        ["The atmosphere will tell you the truth before her mouth does.", "Field Manual 06"]
      ]
    },
    'MOD-07': {
      doctrine: "The roast doctrine is restraint, not volume. Cut once, walk away.",
      attr: "DLFI · The Read",
      method: "Roast Doctrine pillars:",
      points: [
        "<strong>Never raise the voice.</strong> The line lands harder at room temperature.",
        "<strong>Specific over sweeping.</strong> One precise sentence beats a paragraph of insults.",
        "<strong>Read the energy, not the person.</strong> Critique the move, not the soul.",
        "<strong>Leave room for her to feel it later.</strong> The delayed sting is the point.",
        "<strong>Don't laugh at your own line.</strong> Composure is the punchline."
      ],
      quotes: [
        ["A good read holds up in court. A petty one holds up in screenshots.", "Lace Tearer Doctrine"],
        ["Roast like a surgeon, not a flamethrower.", "Field Manual 07"]
      ]
    },
    'MOD-08': {
      doctrine: "Senior operations require the patience of someone who has nothing to prove.",
      attr: "DLFI · Top Secret · Operations Brief",
      method: "Senior operative tenets (preview):",
      points: [
        "<strong>You are not in a hurry.</strong> Time clears most things faster than words can.",
        "<strong>Every emergency is someone else's plan.</strong> Don't let theirs become yours.",
        "<strong>Choose what you investigate.</strong> Not every disrespect deserves your attention.",
        "<strong>Discretion outranks vindication.</strong> The receipts know — that is enough.",
        "<strong>The Department remembers</strong> — what you don't say defines your rank."
      ],
      quotes: [
        ["Senior status is granted when you no longer need anyone to know you've earned it.", "Lace Tearer In Chief"],
        ["The highest move is to file the receipt and keep your face the same.", "Senior Ops · Restricted"]
      ]
    }
  };

  function bindModules() {
    document.querySelectorAll('.training-card').forEach(card => {
      card.addEventListener('click', () => openModule(card));
    });
    const modal = document.getElementById('module-modal');
    if (!modal) return;
    const closeBtn = modal.querySelector('.mm-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModule);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModule(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-on')) closeModule();
    });
  }

  function openModule(card) {
    const modal = document.getElementById('module-modal');
    if (!modal) return;
    const id = card.dataset.mod;
    const data = MODULES[id];
    if (!data) return;
    modal.querySelector('#mm-tag').textContent = card.dataset.modTag || id;
    modal.querySelector('#mm-title').innerHTML = card.dataset.modTitle || id;
    modal.querySelector('#mm-sub').textContent = card.querySelector('.t-desc')?.textContent || '';

    const quotesHTML = data.quotes.map(([q, a]) =>
      `<div class="mm-quote">${q}<span class="attr">— ${a}</span></div>`
    ).join('');
    const pointsHTML = data.points.map(p => `<li>${p}</li>`).join('');

    modal.querySelector('#mm-body').innerHTML = `
      <div class="mm-section">
        <div class="mm-section-h">◆ Doctrine</div>
        <div class="mm-quote">
          ${data.doctrine}
          <span class="attr">— ${data.attr}</span>
        </div>
      </div>
      <div class="mm-section">
        <div class="mm-section-h">◆ ${data.method}</div>
        <ul class="mm-list">${pointsHTML}</ul>
      </div>
      <div class="mm-section">
        <div class="mm-section-h">◆ From the Archive</div>
        ${quotesHTML}
      </div>
    `;
    modal.classList.add('is-on');
  }

  function closeModule() {
    const modal = document.getElementById('module-modal');
    if (modal) modal.classList.remove('is-on');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
