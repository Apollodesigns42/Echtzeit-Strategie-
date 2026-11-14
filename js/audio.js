'use strict';
// ===== Synthetisierte Soundeffekte & Ansagen =====
(function () {
  const A = { ctx: null, master: null, vol: 0.5, voiceOn: true, enabled: true, last: {}, voice: null, musicOn: true };
  A.init = function () {
    if (A.ctx) return;
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = A.vol; A.master.connect(A.ctx.destination);
      const len = A.ctx.sampleRate * 1.5; A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = A.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.enabled = false; }
    if (window.speechSynthesis) {
      const pick = () => { const vs = speechSynthesis.getVoices(); A.voice = vs.find(v => /de(-|_)?/i.test(v.lang)) || null; };
      pick(); speechSynthesis.onvoiceschanged = pick;
    }
  };
  A.setVolume = (v) => { A.vol = v; if (A.master) A.master.gain.value = v; };
  function noise(dur, freq, type, vol, q = 1) {
    const c = A.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = A.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return f;
  }
  function tone(f0, f1, dur, type, vol) {
    const c = A.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.05);
  }
  const SOUNDS = {
    mg: (v) => noise(0.06, 2500, 'bandpass', 0.25 * v, 0.8),
    flak: (v) => { noise(0.1, 1200, 'bandpass', 0.3 * v); },
    cannon: (v) => { noise(0.25, 600, 'lowpass', 0.5 * v); tone(140, 50, 0.2, 'sine', 0.35 * v); },
    bigcannon: (v) => { noise(0.4, 400, 'lowpass', 0.6 * v); tone(100, 35, 0.35, 'sine', 0.5 * v); },
    rocket: (v) => { const f = noise(0.4, 900, 'bandpass', 0.3 * v, 2); f.frequency.exponentialRampToValueAtTime(3000, A.ctx.currentTime + 0.35); },
    laser: (v) => tone(1500, 300, 0.18, 'sawtooth', 0.12 * v),
    biglaser: (v) => { tone(900, 120, 0.4, 'sawtooth', 0.18 * v); tone(1800, 600, 0.3, 'square', 0.05 * v); },
    flame: (v) => noise(0.2, 700, 'lowpass', 0.15 * v),
    acid: (v) => { tone(500, 150, 0.15, 'triangle', 0.15 * v); noise(0.1, 1800, 'highpass', 0.1 * v); },
    claw: (v) => noise(0.05, 3500, 'highpass', 0.15 * v),
    explode: (v) => { noise(0.6, 500, 'lowpass', 0.7 * v); tone(80, 30, 0.5, 'sine', 0.5 * v); },
    explode_s: (v) => { noise(0.35, 700, 'lowpass', 0.45 * v); },
    explode_b: (v) => { noise(1.4, 300, 'lowpass', 0.9 * v); tone(60, 20, 1.2, 'sine', 0.7 * v); },
    die: (v) => tone(320, 140, 0.15, 'triangle', 0.08 * v),
    place: () => { noise(0.3, 300, 'lowpass', 0.5); tone(200, 80, 0.25, 'square', 0.1); },
    sell: () => { tone(800, 1600, 0.15, 'sine', 0.15); },
    click: () => tone(1200, 900, 0.04, 'square', 0.06),
    error: () => tone(220, 160, 0.15, 'square', 0.12),
    rankup: () => { tone(800, 1600, 0.25, 'sine', 0.15); },
    select: () => tone(700, 1000, 0.05, 'sine', 0.08),
    order: () => tone(500, 800, 0.06, 'triangle', 0.1),
    swlaunch: () => { tone(80, 400, 2, 'sawtooth', 0.15); noise(2, 400, 'lowpass', 0.3); },
    swhit: () => { noise(3, 200, 'lowpass', 1.0); tone(50, 15, 2.5, 'sine', 0.9); },
    capture: () => { tone(500, 1000, 0.18, 'square', 0.1); setTimeout(() => A.ctx && tone(1000, 1500, 0.2, 'square', 0.1), 150); },
    power: () => { tone(300, 900, 0.35, 'sawtooth', 0.12); noise(0.3, 1500, 'bandpass', 0.2); },
    crate: () => { tone(900, 1300, 0.1, 'sine', 0.15); setTimeout(() => A.ctx && tone(1300, 1800, 0.14, 'sine', 0.15), 90); },
    alert: () => { tone(880, 880, 0.12, 'square', 0.12); setTimeout(() => A.ctx && tone(660, 660, 0.12, 'square', 0.12), 160); },
  };
  A.play = function (name, vol = 1) {
    if (!A.enabled || !A.ctx || A.vol <= 0) return;
    if (A.ctx.state !== 'running') { if (!A.resuming) { A.resuming = true; A.ctx.resume().catch(() => {}).finally(() => { A.resuming = false; }); } return; }
    const now = performance.now();
    if (now - (A.last[name] || 0) < 45) return;
    A.last[name] = now;
    const fn = SOUNDS[name]; if (!fn) return;
    try { fn(vol); } catch (e) { /* ignorieren */ }
  };
  A.say = function (text) {
    if (!A.voiceOn || !window.speechSynthesis) return;
    try {
      if (speechSynthesis.speaking && speechSynthesis.pending) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; if (A.voice) u.voice = A.voice;
      u.rate = 1.05; u.pitch = 0.75; u.volume = Math.min(1, A.vol * 1.6);
      speechSynthesis.speak(u);
    } catch (e) { /* ignorieren */ }
  };

  // Einfache generative Hintergrundmusik (dunkler Synth-Puls)
  A.music = { timer: null, step: 0 };
  A.startMusic = function () {
    if (!A.ctx || A.music.timer || !A.musicOn) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 61.7];
    A.music.timer = setInterval(() => {
      if (!A.musicOn || A.vol <= 0 || document.hidden || A.ctx.state !== 'running') return;
      const c = A.ctx, t = c.currentTime, s = A.music.step++;
      const f = bass[Math.floor(s / 8) % bass.length];
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(s % 2 ? 300 : 700, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.2);
      const g = c.createGain(); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(lp); lp.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.26);
      if (s % 4 === 0) { noise(0.15, 120, 'lowpass', 0.25); }
      if (s % 8 === 4) { noise(0.08, 3000, 'highpass', 0.05); }
      if (s % 32 === 0) { tone(f * 4, f * 4, 1.6, 'triangle', 0.025); }
    }, 230);
  };
  A.stopMusic = function () { clearInterval(A.music.timer); A.music.timer = null; };
  RTS.audio = A;
})();
