// 犬そだて - main script
// All comments in English per project rules, UI text in Japanese.
(() => {
  'use strict';

  const STORAGE_KEY = 'inu_sodate_save_v1';
  const SHARE_URL = 'https://maxtakaharu34-cmd.github.io/inu-sodate/';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Registered character designs. Each has 5 stages expected at
  // assets/designs/<id>/stage-<0-4>.png. Missing images fall back
  // to the built-in SVG renderer.
  const DESIGNS = [
    { id: 'shiba',       label: '柴犬',        emoji: '🐕' },
    { id: 'poodle',      label: 'プードル',    emoji: '🐩' },
    { id: 'black-shiba', label: '黒柴',        emoji: '🦮' },
    { id: 'dalmatian',   label: 'ダルメシアン', emoji: '🐾' }
  ];
  function designById(id) {
    return DESIGNS.find((d) => d.id === id) || DESIGNS[0];
  }
  function stageImagePath(designId, stageId) {
    return `assets/designs/${designId}/stage-${stageId}.png`;
  }

  // Cache of image availability: { "shiba/0": true | false, ... }
  // Lazily populated on first render attempt.
  const imgAvailability = Object.create(null);
  function probeImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // Gentle simulation-style progression: evolutions come fast so
  // the player feels progress within minutes, not hours.
  const STAGES = [
    { id: 0, minLv: 1,  label: 'こいぬ' },
    { id: 1, minLv: 3,  label: 'わんこ' },
    { id: 2, minLv: 8,  label: '立派な犬' },
    { id: 3, minLv: 18, label: '忠犬' },
    { id: 4, minLv: 35, label: '伝説の犬' }
  ];
  function currentStage(lv) {
    let s = STAGES[0];
    for (const st of STAGES) if (lv >= st.minLv) s = st;
    return s;
  }

  // Softer exp curve than 魔王そだて
  // Lv1 -> ~14 exp, Lv3 -> ~25, Lv8 -> ~65
  const expForLevel = (lv) => Math.floor(10 + lv * 4 + lv * lv * 0.4);

  // ==================== DOM ====================
  const $ = (id) => document.getElementById(id);
  const lvEl = $('lv');
  const expBar = $('exp-bar');
  const hungerVal = $('hunger-val');
  const hungerBar = $('hunger-bar');
  const moodVal = $('mood-val');
  const moodBar = $('mood-bar');
  const ageVal = $('age-val');
  const ageBar = $('age-bar');
  const nameEl = $('name');
  const monsterSvg = $('monster');
  const monsterImg = $('monster-img');
  const monsterWrap = $('monster-wrap');
  const btnDesign = $('btn-design');
  const designOverlay = $('design-overlay');
  const designGrid = $('design-grid');
  const btnDesignClose = $('btn-design-close');
  const floaters = $('floaters');
  const levelupEl = $('levelup');
  const evolveEl = $('evolve');
  const evolveText = $('evolve-text');
  const bubble = $('bubble');
  const stageEl = document.querySelector('.stage');
  const startOverlay = $('start-overlay');
  const startName = $('start-name');
  const btnStart = $('btn-start');
  const btnRename = $('btn-rename');
  const btnShare = $('btn-share');
  const btnMute = $('btn-mute');
  const btnReset = $('btn-reset');
  const deathOverlay = $('death-overlay');
  const deathMsg = $('death-msg');
  const btnRestart = $('btn-restart');
  const actionBtns = document.querySelectorAll('.act-btn');

  // ==================== Audio ====================
  const Sound = (() => {
    let ac = null;
    let muted = localStorage.getItem('inu_muted') === '1';
    const ensure = () => {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    };
    const beep = (freq, dur, type = 'sine', gain = 0.15) => {
      if (muted) return;
      const a = ensure();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur);
    };
    const chord = (freqs, dur, type = 'triangle', gain = 0.1) => {
      freqs.forEach((f) => beep(f, dur, type, gain));
    };
    return {
      prime: () => ensure(),
      // chomp-chomp
      eat:    () => {
        [880, 780, 880, 780].forEach((f, i) =>
          setTimeout(() => beep(f, 0.06, 'square', 0.14), i * 90)
        );
      },
      play:   () => chord([659, 784, 988], 0.22, 'triangle', 0.15),
      train:  () => {
        beep(440, 0.08, 'square', 0.18);
        setTimeout(() => beep(659, 0.14, 'triangle', 0.18), 110);
      },
      praise: () => chord([523, 659, 784, 1047], 0.3, 'sine', 0.11),
      levelUp:() => [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => beep(f, 0.15, 'triangle', 0.2), i * 80)
      ),
      evolve: () => {
        [262, 330, 392, 494, 523, 659, 784, 988].forEach((f, i) =>
          setTimeout(() => beep(f, 0.18, 'triangle', 0.18), i * 110)
        );
      },
      die:    () => [440, 330, 220, 165].forEach((f, i) =>
        setTimeout(() => beep(f, 0.28, 'sine', 0.2), i * 180)
      ),
      err:    () => beep(180, 0.15, 'sawtooth', 0.18),
      toggleMute: () => {
        muted = !muted;
        localStorage.setItem('inu_muted', muted ? '1' : '0');
        return muted;
      },
      isMuted: () => muted
    };
  })();
  btnMute.textContent = Sound.isMuted() ? '🔇' : '🔊';

  // ==================== State ====================
  const defaultState = () => ({
    name: 'ポチ',
    lv: 1,
    exp: 0,
    hunger: 60,
    mood: 85,
    ageSec: 0,
    lastTs: Date.now(),
    stageId: 0,
    designId: 'shiba',
    isDead: false,
    born: Date.now()
  });
  let state = loadState() || null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s !== 'object' || !s) return null;
      return s;
    } catch {
      return null;
    }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ==================== SVG rendering ====================
  function setMonsterSvg(svgBodyString) {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="${SVG_NS}" viewBox="0 0 200 200">${svgBodyString}</svg>`,
      'image/svg+xml'
    );
    while (monsterSvg.firstChild) monsterSvg.removeChild(monsterSvg.firstChild);
    for (const n of Array.from(doc.documentElement.childNodes)) {
      monsterSvg.appendChild(document.importNode(n, true));
    }
  }

  function buildMonsterSvg(stageId, mood) {
    const eyeMood = mood < 30 ? 'sad' : mood > 70 ? 'happy' : 'neutral';
    switch (stageId) {
      case 0: return stagePuppy(eyeMood);
      case 1: return stageYoung(eyeMood);
      case 2: return stageAdult(eyeMood);
      case 3: return stageLoyal(eyeMood);
      case 4: return stageLegend(eyeMood);
      default: return stagePuppy(eyeMood);
    }
  }

  // Shared eye / mouth / nose helpers
  function eyes(cx1, cx2, cy, mood, size = 5) {
    if (mood === 'sad') {
      return `
        <path d="M ${cx1 - size} ${cy} Q ${cx1} ${cy + size} ${cx1 + size} ${cy}" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M ${cx2 - size} ${cy} Q ${cx2} ${cy + size} ${cx2 + size} ${cy}" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
    }
    if (mood === 'happy') {
      return `
        <path d="M ${cx1 - size} ${cy + 2} Q ${cx1} ${cy - size} ${cx1 + size} ${cy + 2}" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M ${cx2 - size} ${cy + 2} Q ${cx2} ${cy - size} ${cx2 + size} ${cy + 2}" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
    }
    return `
      <circle cx="${cx1}" cy="${cy}" r="${size}" fill="#000"/>
      <circle cx="${cx1 - 1}" cy="${cy - 1}" r="${size * 0.35}" fill="#fff"/>
      <circle cx="${cx2}" cy="${cy}" r="${size}" fill="#000"/>
      <circle cx="${cx2 - 1}" cy="${cy - 1}" r="${size * 0.35}" fill="#fff"/>
    `;
  }
  function nose(cx, cy) {
    return `
      <ellipse cx="${cx}" cy="${cy}" rx="5" ry="4" fill="#1a1a1a" stroke="#000" stroke-width="1.5"/>
      <ellipse cx="${cx - 1.2}" cy="${cy - 1.2}" rx="1.5" ry="1" fill="#555"/>
    `;
  }
  function mouth(cx, cy, mood) {
    if (mood === 'sad') {
      return `
        <path d="M ${cx - 8} ${cy + 6} Q ${cx} ${cy} ${cx + 8} ${cy + 6}" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
    }
    return `
      <path d="M ${cx - 10} ${cy} Q ${cx - 4} ${cy + 9} ${cx} ${cy + 5} Q ${cx + 4} ${cy + 9} ${cx + 10} ${cy}"
            stroke="#000" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M ${cx - 3} ${cy + 5} Q ${cx} ${cy + 10} ${cx + 3} ${cy + 5} Z" fill="#ff7aa8" stroke="#000" stroke-width="1.5"/>
    `;
  }

  function stagePuppy(mood) {
    return `
      <defs>
        <linearGradient id="pf" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff3dc"/>
          <stop offset="100%" stop-color="#e8c89a"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="135" rx="38" ry="30" fill="url(#pf)" stroke="#000" stroke-width="4"/>
      <ellipse cx="80" cy="160" rx="8" ry="10" fill="url(#pf)" stroke="#000" stroke-width="3"/>
      <ellipse cx="120" cy="160" rx="8" ry="10" fill="url(#pf)" stroke="#000" stroke-width="3"/>
      <path d="M 132 130 Q 150 115 148 100" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M 132 130 Q 150 115 148 100" stroke="#e8c89a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="100" cy="85" r="42" fill="url(#pf)" stroke="#000" stroke-width="4"/>
      <path d="M 62 75 Q 48 85 55 110 Q 70 100 72 90 Z" fill="#c89060" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 138 75 Q 152 85 145 110 Q 130 100 128 90 Z" fill="#c89060" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="85" cy="82" rx="13" ry="12" fill="#c89060" opacity="0.65"/>
      ${eyes(85, 115, 85, mood, 5)}
      ${nose(100, 100)}
      ${mouth(100, 108, mood)}
      <circle cx="72" cy="103" r="5" fill="#ffb6c7" opacity="0.7"/>
      <circle cx="128" cy="103" r="5" fill="#ffb6c7" opacity="0.7"/>
    `;
  }

  function stageYoung(mood) {
    return `
      <defs>
        <linearGradient id="yf" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f8ebd0"/>
          <stop offset="100%" stop-color="#d9b079"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="130" rx="48" ry="36" fill="url(#yf)" stroke="#000" stroke-width="4"/>
      <ellipse cx="75" cy="165" rx="9" ry="12" fill="url(#yf)" stroke="#000" stroke-width="3"/>
      <ellipse cx="125" cy="165" rx="9" ry="12" fill="url(#yf)" stroke="#000" stroke-width="3"/>
      <ellipse cx="92" cy="165" rx="7" ry="10" fill="url(#yf)" stroke="#000" stroke-width="2.5"/>
      <ellipse cx="108" cy="165" rx="7" ry="10" fill="url(#yf)" stroke="#000" stroke-width="2.5"/>
      <path d="M 145 120 Q 168 105 165 85" stroke="#000" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="78" rx="40" ry="38" fill="url(#yf)" stroke="#000" stroke-width="4"/>
      <path d="M 64 60 Q 52 40 64 30 Q 72 48 76 68 Z" fill="#b8824a" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 136 60 Q 148 40 136 30 Q 128 48 124 68 Z" fill="#b8824a" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="86" cy="78" rx="12" ry="11" fill="#b8824a" opacity="0.6"/>
      ${eyes(86, 114, 80, mood, 5)}
      ${nose(100, 95)}
      ${mouth(100, 104, mood)}
      <rect x="78" y="113" width="44" height="7" rx="3" fill="#ff6b35" stroke="#000" stroke-width="2.5"/>
      <circle cx="100" cy="120" r="3.5" fill="#ffd700" stroke="#000" stroke-width="1.5"/>
    `;
  }

  function stageAdult(mood) {
    return `
      <defs>
        <linearGradient id="af" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f2e2c2"/>
          <stop offset="100%" stop-color="#c79b65"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="128" rx="56" ry="40" fill="url(#af)" stroke="#000" stroke-width="4"/>
      <rect x="66" y="150" width="14" height="28" rx="5" fill="url(#af)" stroke="#000" stroke-width="3"/>
      <rect x="120" y="150" width="14" height="28" rx="5" fill="url(#af)" stroke="#000" stroke-width="3"/>
      <rect x="88" y="155" width="10" height="22" rx="4" fill="url(#af)" stroke="#000" stroke-width="2.5"/>
      <rect x="102" y="155" width="10" height="22" rx="4" fill="url(#af)" stroke="#000" stroke-width="2.5"/>
      <path d="M 152 115 Q 178 90 170 70 Q 162 82 156 100 Z" fill="url(#af)" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="74" rx="42" ry="40" fill="url(#af)" stroke="#000" stroke-width="4"/>
      <path d="M 64 52 L 60 22 L 82 56 Z" fill="#a56f3e" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 136 52 L 140 22 L 118 56 Z" fill="#a56f3e" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="82" cy="75" rx="15" ry="12" fill="#a56f3e" opacity="0.55"/>
      ${eyes(84, 116, 76, mood, 6)}
      ${nose(100, 94)}
      ${mouth(100, 104, mood)}
      <rect x="70" y="108" width="60" height="9" rx="4" fill="#6b3f1a" stroke="#000" stroke-width="2.5"/>
      <circle cx="82" cy="113" r="2.5" fill="#ffd700"/>
      <circle cx="100" cy="113" r="2.5" fill="#ffd700"/>
      <circle cx="118" cy="113" r="2.5" fill="#ffd700"/>
    `;
  }

  function stageLoyal(mood) {
    return `
      <defs>
        <linearGradient id="lf" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff1cc"/>
          <stop offset="100%" stop-color="#a86e34"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="180" rx="60" ry="7" fill="#000" opacity="0.25"/>
      <ellipse cx="100" cy="125" rx="60" ry="42" fill="url(#lf)" stroke="#000" stroke-width="4"/>
      <path d="M 75 130 Q 85 148 100 150 Q 115 148 125 130 Q 115 140 100 140 Q 85 140 75 130 Z" fill="#fff1cc" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="62" y="150" width="16" height="32" rx="6" fill="url(#lf)" stroke="#000" stroke-width="3"/>
      <rect x="122" y="150" width="16" height="32" rx="6" fill="url(#lf)" stroke="#000" stroke-width="3"/>
      <rect x="86" y="155" width="12" height="26" rx="5" fill="url(#lf)" stroke="#000" stroke-width="2.5"/>
      <rect x="102" y="155" width="12" height="26" rx="5" fill="url(#lf)" stroke="#000" stroke-width="2.5"/>
      <path d="M 156 110 Q 186 85 175 55 Q 168 78 160 95 Z" fill="url(#lf)" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="68" rx="44" ry="42" fill="url(#lf)" stroke="#000" stroke-width="4"/>
      <path d="M 60 46 L 54 14 L 82 52 Z" fill="#805028" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 140 46 L 146 14 L 118 52 Z" fill="#805028" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 70 68 Q 80 58 96 66 Q 92 78 78 80 Q 70 76 70 68 Z" fill="#805028" opacity="0.6"/>
      ${eyes(82, 118, 70, mood, 6)}
      ${nose(100, 90)}
      ${mouth(100, 100, mood)}
      <rect x="64" y="106" width="72" height="11" rx="5" fill="#d93a1a" stroke="#000" stroke-width="3"/>
      <circle cx="100" cy="124" r="8" fill="#ffd700" stroke="#000" stroke-width="2.5"/>
      <path d="M 100 119 L 101.5 123 L 105 123 L 102 125 L 103 128 L 100 126 L 97 128 L 98 125 L 95 123 L 98.5 123 Z" fill="#b87f00"/>
    `;
  }

  function stageLegend(mood) {
    return `
      <defs>
        <linearGradient id="lgf" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fffdf0"/>
          <stop offset="100%" stop-color="#c9a35a"/>
        </linearGradient>
        <linearGradient id="lgh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffd700"/>
          <stop offset="50%" stop-color="#fff"/>
          <stop offset="100%" stop-color="#ffd700"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="10" rx="30" ry="8" fill="none" stroke="url(#lgh)" stroke-width="4"/>
      <ellipse cx="100" cy="180" rx="68" ry="8" fill="#000" opacity="0.3"/>
      <ellipse cx="100" cy="122" rx="64" ry="44" fill="url(#lgf)" stroke="#000" stroke-width="4"/>
      <path d="M 70 126 Q 82 150 100 152 Q 118 150 130 126 Q 115 142 100 142 Q 85 142 70 126 Z" fill="#fffdf0" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M 36 90 Q 8 70 18 120 Q 40 100 56 110 Q 48 95 36 90 Z" fill="#fff9d8" opacity="0.85" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <path d="M 164 90 Q 192 70 182 120 Q 160 100 144 110 Q 152 95 164 90 Z" fill="#fff9d8" opacity="0.85" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <rect x="60" y="150" width="18" height="32" rx="7" fill="url(#lgf)" stroke="#000" stroke-width="3"/>
      <rect x="122" y="150" width="18" height="32" rx="7" fill="url(#lgf)" stroke="#000" stroke-width="3"/>
      <rect x="84" y="155" width="12" height="26" rx="5" fill="url(#lgf)" stroke="#000" stroke-width="2.5"/>
      <rect x="104" y="155" width="12" height="26" rx="5" fill="url(#lgf)" stroke="#000" stroke-width="2.5"/>
      <path d="M 158 105 Q 192 75 182 45 Q 170 70 162 92 Z" fill="url(#lgf)" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="66" rx="44" ry="42" fill="url(#lgf)" stroke="#000" stroke-width="4"/>
      <path d="M 70 36 L 76 18 L 88 32 L 100 14 L 112 32 L 124 18 L 130 36 L 126 44 L 74 44 Z"
            fill="#ffd700" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="100" cy="22" r="3.5" fill="#ff0055" stroke="#000" stroke-width="1.5"/>
      <circle cx="82" cy="36" r="2.5" fill="#00aaff" stroke="#000" stroke-width="1.5"/>
      <circle cx="118" cy="36" r="2.5" fill="#00aaff" stroke="#000" stroke-width="1.5"/>
      <path d="M 62 48 L 56 18 L 82 52 Z" fill="#8a6a2c" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 138 48 L 144 18 L 118 52 Z" fill="#8a6a2c" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>
      ${eyes(82, 118, 68, mood, 6)}
      ${nose(100, 88)}
      ${mouth(100, 98, mood)}
      <rect x="60" y="104" width="80" height="12" rx="5" fill="#0050ff" stroke="#000" stroke-width="3"/>
      <circle cx="76" cy="110" r="2.5" fill="#ffd700"/>
      <circle cx="100" cy="110" r="3.5" fill="#ff3355" stroke="#000" stroke-width="1.5"/>
      <circle cx="124" cy="110" r="2.5" fill="#ffd700"/>
    `;
  }

  function renderMonster() {
    const st = currentStage(state.lv);
    const designId = state.designId || 'shiba';
    const imgUrl = stageImagePath(designId, st.id);
    const cacheKey = `${designId}/${st.id}`;

    // Try to use the per-design PNG first; fall back to the built-in SVG
    // renderer if the image 404s or isn't there yet.
    const useImage = () => {
      monsterImg.src = imgUrl;
      monsterWrap.classList.add('has-image');
    };
    const useSvg = () => {
      setMonsterSvg(buildMonsterSvg(st.id, state.mood));
      monsterWrap.classList.remove('has-image');
    };

    if (imgAvailability[cacheKey] === true) {
      useImage();
    } else if (imgAvailability[cacheKey] === false) {
      useSvg();
    } else {
      // First probe: show SVG immediately so the user sees something,
      // then upgrade to image if available.
      useSvg();
      probeImage(imgUrl).then((ok) => {
        imgAvailability[cacheKey] = ok;
        if (ok && state.stageId === st.id && state.designId === designId) {
          useImage();
        }
      });
    }

    monsterWrap.classList.remove('happy', 'grumpy');
    if (state.mood > 75) monsterWrap.classList.add('happy');
    else if (state.mood < 30) monsterWrap.classList.add('grumpy');
  }

  // Retriggerable one-shot action animation.
  function playActionAnimation(cls) {
    monsterWrap.classList.remove('act-eat', 'act-play', 'act-train', 'act-praise');
    void monsterWrap.offsetWidth;
    monsterWrap.classList.add(cls);
    clearTimeout(playActionAnimation._t);
    playActionAnimation._t = setTimeout(() => {
      monsterWrap.classList.remove(cls);
    }, 1500);
  }

  // ==================== UI update ====================
  function pct(v, max = 100) {
    return Math.max(0, Math.min(100, (v / max) * 100));
  }
  function updateUi() {
    lvEl.textContent = state.lv;
    nameEl.textContent = state.name;
    const need = expForLevel(state.lv);
    expBar.style.width = pct(state.exp, need) + '%';
    hungerVal.textContent = Math.round(state.hunger);
    hungerBar.style.width = pct(state.hunger) + '%';
    moodVal.textContent = Math.round(state.mood);
    moodBar.style.width = pct(state.mood) + '%';
    const days = Math.floor(state.ageSec / 3600);
    ageVal.textContent = days;
    ageBar.style.width = Math.min(100, (days / 30) * 100) + '%';
  }

  // ==================== Game actions ====================
  function speak(text, ms = 1500) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(speak._t);
    speak._t = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function floatText(text, kind = 'exp') {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    el.style.left = 40 + Math.random() * 20 + '%';
    el.style.top = 40 + Math.random() * 20 + '%';
    floaters.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // Drop a prop emoji (bowl / ball / bone / heart) above the pet.
  function dropProp(emoji, opts = {}) {
    const el = document.createElement('div');
    el.className = 'prop';
    el.textContent = emoji;
    el.style.left = (opts.x ?? 50) + '%';
    el.style.top = (opts.y ?? 60) + '%';
    stageEl.appendChild(el);
    setTimeout(() => el.remove(), 1250);
  }

  function flashLevelUp() {
    levelupEl.classList.remove('show');
    void levelupEl.offsetWidth;
    levelupEl.classList.add('show');
    clearTimeout(flashLevelUp._t);
    flashLevelUp._t = setTimeout(() => levelupEl.classList.remove('show'), 1700);
  }
  function flashEvolve(label) {
    evolveText.textContent = label + ' に成長！';
    evolveEl.classList.remove('show');
    void evolveEl.offsetWidth;
    evolveEl.classList.add('show');
    clearTimeout(flashEvolve._t);
    flashEvolve._t = setTimeout(() => evolveEl.classList.remove('show'), 2500);
  }

  function addExp(amount) {
    state.exp += amount;
    floatText(`+${amount} EXP`, 'exp');
    while (state.exp >= expForLevel(state.lv)) {
      state.exp -= expForLevel(state.lv);
      state.lv++;
      const prevStage = state.stageId;
      const st = currentStage(state.lv);
      if (st.id !== prevStage) {
        state.stageId = st.id;
        Sound.evolve();
        setTimeout(() => {
          flashEvolve(st.label);
          renderMonster();
          speak(st.label + 'になった！', 2800);
        }, 250);
      } else {
        Sound.levelUp();
        flashLevelUp();
      }
    }
  }

  function doAction(kind) {
    if (state.isDead) return;
    Sound.prime();
    switch (kind) {
      case 'eat':
        if (state.hunger >= 95) {
          speak('もうおなかいっぱい…');
          Sound.err();
          return;
        }
        state.hunger = Math.min(100, state.hunger + 28);
        state.mood = Math.min(100, state.mood + 4);
        floatText('+28 食欲', 'food');
        Sound.eat();
        speak('もぐもぐ…');
        dropProp('🍖');
        playActionAnimation('act-eat');
        addExp(6);
        break;
      case 'play':
        if (state.hunger <= 10) {
          speak('おなかすいた…');
          Sound.err();
          return;
        }
        state.mood = Math.min(100, state.mood + 22);
        state.hunger = Math.max(0, state.hunger - 8);
        floatText('+22 きげん', 'love');
        Sound.play();
        speak('わーい！');
        dropProp('🎾');
        playActionAnimation('act-play');
        addExp(14);
        break;
      case 'train':
        if (state.hunger <= 15) {
          speak('ちょっとつかれた…');
          Sound.err();
          return;
        }
        state.hunger = Math.max(0, state.hunger - 10);
        state.mood = Math.max(0, state.mood - 3);
        floatText('+25 EXP', 'exp');
        Sound.train();
        speak('おすわり！');
        dropProp('🦴');
        playActionAnimation('act-train');
        addExp(25);
        break;
      case 'praise':
        state.mood = Math.min(100, state.mood + 18);
        floatText('+18 きげん', 'love');
        Sound.praise();
        speak('わふっ♪');
        dropProp('💕');
        playActionAnimation('act-praise');
        addExp(10);
        break;
    }
    updateUi();
    renderMonster();
    saveState();
  }

  actionBtns.forEach((btn) => {
    btn.addEventListener('click', () => doAction(btn.dataset.act));
  });

  // ==================== Time tick ====================
  let tickTimer = null;
  function startTicker() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => tick(1), 1000);
  }
  function tick(seconds) {
    if (state.isDead) return;
    state.ageSec += seconds;
    state.hunger = Math.max(0, state.hunger - 0.1 * seconds);
    const moodDrop = state.hunger < 20 ? 0.22 : 0.04;
    state.mood = Math.max(0, state.mood - moodDrop * seconds);
    if (Math.random() < 0.02 * seconds) addExp(1);
    if (state.hunger <= 0 && state.mood <= 0) {
      die('ずっとほうって置いてたから、犬は旅立った…');
      return;
    }
    updateUi();
    saveState();
  }

  function applyOfflineCatchup() {
    if (!state.lastTs) return;
    const elapsed = Math.min(86400, Math.floor((Date.now() - state.lastTs) / 1000));
    if (elapsed > 0) tick(elapsed);
    state.lastTs = Date.now();
    saveState();
  }
  setInterval(() => {
    if (state) {
      state.lastTs = Date.now();
      saveState();
    }
  }, 10 * 1000);

  // ==================== Death / restart ====================
  function die(msg) {
    state.isDead = true;
    saveState();
    Sound.die();
    deathMsg.textContent = msg;
    deathOverlay.classList.add('show');
  }
  btnRestart.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    deathOverlay.classList.remove('show');
    state = null;
    startOverlay.classList.add('show');
    startName.value = 'ポチ';
  });

  // ==================== Start ====================
  btnStart.addEventListener('click', () => {
    Sound.prime();
    const name = (startName.value || 'ポチ').slice(0, 10);
    state = defaultState();
    state.name = name;
    saveState();
    startOverlay.classList.remove('show');
    renderMonster();
    updateUi();
    startTicker();
    speak('わん！');
  });

  // ==================== Controls ====================
  // ==================== Design picker ====================
  async function buildDesignGrid() {
    while (designGrid.firstChild) designGrid.removeChild(designGrid.firstChild);
    const currentId = state?.designId || 'shiba';
    // Probe the stage-0 image of each design for the thumbnail.
    await Promise.all(
      DESIGNS.map(async (d) => {
        const url = stageImagePath(d.id, 0);
        const ok = await probeImage(url);
        imgAvailability[`${d.id}/0`] = ok;
        const card = document.createElement('div');
        card.className = 'design-card' + (d.id === currentId ? ' selected' : '') + (ok ? '' : ' missing');
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (ok) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = d.label;
          thumb.appendChild(img);
        } else {
          const fb = document.createElement('div');
          fb.className = 'thumb-fallback';
          fb.textContent = d.emoji || '🐶';
          thumb.appendChild(fb);
        }
        const lbl = document.createElement('div');
        lbl.textContent = d.label;
        card.appendChild(thumb);
        card.appendChild(lbl);
        if (!ok) {
          const tag = document.createElement('div');
          tag.className = 'missing-tag';
          tag.textContent = '画像まだ';
          card.appendChild(tag);
        }
        card.addEventListener('click', () => {
          if (!state) return;
          state.designId = d.id;
          saveState();
          // Invalidate image cache for this design in case it was probed earlier
          Object.keys(imgAvailability).forEach((k) => {
            if (k.startsWith(d.id + '/')) delete imgAvailability[k];
          });
          buildDesignGrid();
          renderMonster();
          designOverlay.classList.remove('show');
          speak('よろしく！');
        });
        designGrid.appendChild(card);
      })
    );
  }
  btnDesign.addEventListener('click', () => {
    if (!state) return;
    buildDesignGrid();
    designOverlay.classList.add('show');
  });
  btnDesignClose.addEventListener('click', () => {
    designOverlay.classList.remove('show');
  });
  designOverlay.addEventListener('click', (e) => {
    if (e.target === designOverlay) designOverlay.classList.remove('show');
  });

  btnRename.addEventListener('click', () => {
    const newName = prompt('あたらしい名前をいれて', state?.name || '');
    if (newName && state) {
      state.name = newName.slice(0, 10);
      saveState();
      updateUi();
    }
  });
  btnShare.addEventListener('click', () => {
    const st = currentStage(state.lv);
    const text = `${state.name}（Lv.${state.lv} ${st.label}）を育ててる！ #犬そだて`;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  btnMute.addEventListener('click', () => {
    const m = Sound.toggleMute();
    btnMute.textContent = m ? '🔇' : '🔊';
  });
  btnReset.addEventListener('click', () => {
    if (!confirm('リセットしますか？育成中の犬は消えます')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = null;
    startOverlay.classList.add('show');
    startName.value = 'ポチ';
  });

  // ==================== Init ====================
  if (state && !state.isDead) {
    renderMonster();
    updateUi();
    applyOfflineCatchup();
    updateUi();
    startTicker();
  } else if (state && state.isDead) {
    renderMonster();
    updateUi();
    deathMsg.textContent = '前の犬は旅立った…もう一度育てる？';
    deathOverlay.classList.add('show');
  } else {
    startOverlay.classList.add('show');
  }
})();
