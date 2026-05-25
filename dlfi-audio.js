// ============================================================
// DLFI Investigation Audio Engine
// Cinematic, low-volume, all-synthesized via Web Audio API.
// No external assets. Toggleable. Respects reduced-motion.
// ============================================================
(function () {
  const STORAGE_KEY = 'dlfi.audio.enabled';
  let ctx = null;
  let masterGain = null;
  let ambientNodes = [];
  let enabled = false;
  let unlocked = false;

  // ---------- Setup ----------
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0; // start silent, ramp up on enable
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    if (unlocked) return;
    ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  // ---------- Ambient bed ----------
  // Layered: filtered brown noise (rumble) + slow detuned pads + occasional radio crackle.
  function startAmbient() {
    if (!ctx) return;
    stopAmbient();

    const now = ctx.currentTime;

    // 1. Low brown-noise rumble (HVAC / control room hum)
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.0;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 220;
    noiseFilter.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.18;

    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noise.start(now);

    // 2. Slow detuned pad — two oscillators a fifth apart, very soft
    function makePad(freq, detune, level) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0;
      // slow fade-in/out cycle
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.04 + Math.random() * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = level;
      lfo.connect(lfoGain).connect(g.gain);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 1200;
      osc.connect(g).connect(filt).connect(masterGain);
      osc.start(now);
      lfo.start(now);
      return { osc, lfo, g, filt };
    }

    const pad1 = makePad(110, -4, 0.025); // A2
    const pad2 = makePad(164.81, +3, 0.018); // E3
    const pad3 = makePad(220, -7, 0.012);  // A3

    // 3. Neon electrical hum — 60hz with slight detune wobble
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 60;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 180;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.012;
    const humLfo = ctx.createOscillator();
    humLfo.type = 'sine';
    humLfo.frequency.value = 0.15;
    const humLfoGain = ctx.createGain();
    humLfoGain.gain.value = 0.6;
    humLfo.connect(humLfoGain).connect(hum.detune);
    hum.connect(humFilter).connect(humGain).connect(masterGain);
    hum.start(now);
    humLfo.start(now);

    ambientNodes = [noise, pad1, pad2, pad3, hum, humLfo];

    // Schedule occasional dispatch/radio textures
    scheduleAmbientEvents();
  }

  function stopAmbient() {
    ambientNodes.forEach((n) => {
      try {
        if (n.osc) { n.osc.stop(); }
        else if (n.stop) { n.stop(); }
        if (n.lfo) { n.lfo.stop(); }
      } catch (e) { /* ignore */ }
    });
    ambientNodes = [];
    if (eventTimer) { clearTimeout(eventTimer); eventTimer = null; }
  }

  // Occasional far-away radio chirp / dispatch blip
  let eventTimer = null;
  function scheduleAmbientEvents() {
    if (!enabled) return;
    const delay = 14000 + Math.random() * 22000;
    eventTimer = setTimeout(() => {
      if (!enabled) return;
      if (Math.random() < 0.5) radioChirp();
      else distantTone();
      scheduleAmbientEvents();
    }, delay);
  }

  function radioChirp() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(1200, now);
    o.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.018, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 6;
    o.connect(bp).connect(g).connect(masterGain);
    o.start(now);
    o.stop(now + 0.2);
  }

  function distantTone() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.014, now + 0.4);
    g.gain.linearRampToValueAtTime(0, now + 1.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    o.connect(lp).connect(g).connect(masterGain);
    o.start(now);
    o.stop(now + 1.4);
  }

  // ---------- UI sounds ----------
  function envelope(node, gainNode, attack, decay, peak) {
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    node.start(now);
    node.stop(now + attack + decay + 0.05);
  }

  function click() {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2400;
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    o.connect(hp).connect(g).connect(masterGain);
    envelope(o, g, 0.001, 0.045, 0.05);
  }

  function hover() {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1800;
    const g = ctx.createGain();
    o.connect(g).connect(masterGain);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.014, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.start(now);
    o.stop(now + 0.15);
  }

  function stamp() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // Low impact thud
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, now);
    o.frequency.exponentialRampToValueAtTime(50, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(masterGain);
    o.start(now);
    o.stop(now + 0.3);

    // Click attack on top
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    n.connect(hp).connect(ng).connect(masterGain);
    n.start(now);
  }

  function dossierOpen() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // Filtered noise burst — paper rustle
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * (1 - t) * 0.6;
    }
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(800, now + 0.45);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    n.connect(bp).connect(g).connect(masterGain);
    n.start(now);

    // Lock-click on top
    setTimeout(() => unlockTick(), 50);
  }

  function unlockTick() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.025, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    o.connect(hp).connect(g).connect(masterGain);
    o.start(now);
    o.stop(now + 0.05);
  }

  function ring() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // Old-school phone bell-ish tone (two oscillators alternating)
    function tone(t0, dur) {
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 480;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 620;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
      g.gain.linearRampToValueAtTime(0.05, t0 + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o1.connect(g);
      o2.connect(g);
      g.connect(masterGain);
      o1.start(t0); o1.stop(t0 + dur + 0.05);
      o2.start(t0); o2.stop(t0 + dur + 0.05);
    }
    tone(now, 0.4);
    tone(now + 0.5, 0.4);
  }

  function pageEnter() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    // Soft swoosh + low sub
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.6;
    }
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.55);
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    n.connect(bp).connect(g).connect(masterGain);
    n.start(now);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.6);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.linearRampToValueAtTime(0.1, now + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    sub.connect(sg).connect(masterGain);
    sub.start(now);
    sub.stop(now + 0.8);
  }

  function alert() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, now);
    o.frequency.linearRampToValueAtTime(1200, now + 0.15);
    o.frequency.linearRampToValueAtTime(900, now + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.02);
    g.gain.linearRampToValueAtTime(0, now + 0.32);
    o.connect(g).connect(masterGain);
    o.start(now);
    o.stop(now + 0.35);
  }

  // ---------- Public API ----------
  function enable() {
    ensureCtx();
    if (!ctx) return false;
    unlock();
    enabled = true;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.linearRampToValueAtTime(0.65, now + 0.8);
    startAmbient();
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    document.documentElement.setAttribute('data-audio', 'on');
    pageEnter();
    return true;
  }

  function disable() {
    enabled = false;
    if (!ctx) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.linearRampToValueAtTime(0, now + 0.4);
    setTimeout(stopAmbient, 500);
    try { localStorage.setItem(STORAGE_KEY, '0'); } catch (e) {}
    document.documentElement.setAttribute('data-audio', 'off');
  }

  function toggle() {
    if (enabled) { disable(); return false; }
    return enable();
  }

  function isEnabled() { return enabled; }

  // Restore preference
  function restore() {
    let pref = null;
    try { pref = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    document.documentElement.setAttribute('data-audio', pref === '1' ? 'on' : 'off');
    // We DON'T auto-enable — browsers require a user gesture. Just mark the pref.
    return pref === '1';
  }

  window.DLFIAudio = {
    enable, disable, toggle, isEnabled, restore,
    click, hover, stamp, dossierOpen, ring, pageEnter, alert, unlockTick,
  };
})();
