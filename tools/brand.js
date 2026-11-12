// @u-theme-start — Universal theme engine: custom (C), presets (D), WebAudio SFX (E), preset I/O (F)
(function (root) {
  'use strict';
  const KEY = 'u_theme_v1';
  const HEX = /^#[0-9a-f]{6}$/i;

  /* ---------- WCAG 2.x ---------- */
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = h => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // เลือกดำหรือขาวล้วน อันที่ตัดกว่า → การันตีทางคณิตว่า ≥ 4.58:1 กับทุกสีพื้น
  const onColor = bg => (contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  function ensureContrast(fg, bg, min = 4.5) {
    if (contrast(fg, bg) >= min) return fg;
    const to = onColor(bg);
    for (let i = 1; i <= 20; i++) { const c = mix(fg, to, i / 20); if (contrast(c, bg) >= min) return c; }
    return to;
  }

  /* ---------- palettes ---------- */
  const BASES = {
    dark:  { bg: '#0d0f14', surface: '#171a22', ink: '#f1f3f8', muted: '#aab1c2', line: '#000000', shadow: '#000000' },
    light: { bg: '#f4f1ea', surface: '#ffffff', ink: '#14161c', muted: '#4a5060', line: '#14161c', shadow: '#14161c' }
  };
  // 7 ธีมเดิม: ถ้า theme.css เดิมมี hex อยู่แล้ว ให้คัดมาแทนตรงนี้ เพื่อให้มีแหล่งค่าสีเดียว
  const PRESETS = {
    universal: { base: 'dark', a1: '#ffcc00', a2: '#00d1ff' },
    fps:    { base: 'dark', bg: '#0a0c0a', surface: '#141814', a1: '#ff4d2e', a2: '#c8ff3d' },
    rpg:    { base: 'dark', bg: '#120d08', surface: '#1f170f', a1: '#e8b04a', a2: '#6fd3a8' },
    roblox: { base: 'dark', bg: '#0e1116', surface: '#1a1f29', a1: '#ff3d3d', a2: '#4da3ff' },
    block:  { base: 'dark', bg: '#0c120a', surface: '#17210f', a1: '#7bd147', a2: '#c08a50' },
    cyber:  { base: 'dark', bg: '#07060f', surface: '#120f24', a1: '#ff2bd6', a2: '#22f0ff' },
    light:  { base: 'light', a1: '#e63946', a2: '#1d6fd8' },
    horror: { base: 'dark', bg: '#0b0708', surface: '#1a0f10', ink: '#f2e8e4', muted: '#b9a6a2', a1: '#ff3b3b', a2: '#9be564' }, // D
    space:  { base: 'dark', bg: '#070b1a', surface: '#101735', ink: '#eef2ff', muted: '#a9b4d6', a1: '#7cc4ff', a2: '#ffd166' }, // D
    persona: { base: 'dark', bg: '#000000', surface: '#0d0d0d', ink: '#ffffff', muted: '#c9c9c9', line: '#ffffff', shadow: '#e60012', a1: '#e60012', a2: '#ffffff' } // P5: crimson / black / white
  };
  const SKINS = [...Object.keys(PRESETS), 'custom'];
  const NAMES = { universal: 'Universal', fps: 'FPS', rpg: 'RPG', roblox: 'Brick', block: 'Block', cyber: 'Cyber',
                  light: 'Light', horror: 'Horror', space: 'Space', persona: 'Persona', custom: 'Custom' };
  const DEFAULT = { skin: 'universal', base: 'dark', a1: '#ffcc00', a2: '#00d1ff', depth: 4, radius: 0, bw: 3, motion: true, sfx: 'auto' };

  /* ---------- state ---------- */
  const num = (v, lo, hi, d) => ((typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(+v)
    ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  const col = (v, d) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);
  function sanitize(p) { // whitelist อย่างเดียว → preset ไม่มีทางพา PromptPay / relay / token ไปด้วย
    p = p && typeof p === 'object' ? p : {};
    return {
      skin: SKINS.includes(p.skin) ? p.skin : DEFAULT.skin,
      base: p.base === 'light' ? 'light' : 'dark',
      a1: col(p.a1, DEFAULT.a1), a2: col(p.a2, DEFAULT.a2),
      depth: num(p.depth, 0, 8, DEFAULT.depth), radius: num(p.radius, 0, 12, DEFAULT.radius), bw: num(p.bw, 2, 5, DEFAULT.bw),
      motion: p.motion !== false,
      sfx: SFX_PACKS.includes(p.sfx) ? p.sfx : DEFAULT.sfx
    };
  }
  function tokens(s) {
    const p = s.skin === 'custom' ? { base: s.base, a1: s.a1, a2: s.a2 } : PRESETS[s.skin] || PRESETS.universal;
    const t = Object.assign({}, BASES[p.base] || BASES.dark, p);
    t.onA1 = onColor(t.a1); t.onA2 = onColor(t.a2);
    t.a1Text = ensureContrast(t.a1, t.surface); t.a2Text = ensureContrast(t.a2, t.surface);
    t.halo = onColor(t.ink);
    return t;
  }
  function cssVars(s) {
    const t = tokens(s);
    return { '--u-bg': t.bg, '--u-surface': t.surface, '--u-ink': t.ink, '--u-muted': t.muted, '--u-line': t.line,
      '--u-shadow': t.shadow, '--u-halo': t.halo, '--u-a1': t.a1, '--u-a2': t.a2, '--u-on-a1': t.onA1, '--u-on-a2': t.onA2,
      '--u-a1-text': t.a1Text, '--u-a2-text': t.a2Text, '--u-depth': s.depth + 'px', '--u-radius': s.radius + 'px', '--u-bw': s.bw + 'px' };
  }

  /* ---------- F: preset I/O ---------- */
  const exportPreset = s => JSON.stringify(Object.assign({ kind: 'donate-theme', v: 1 }, sanitize(s)), null, 2);
  function importPreset(text) {
    if (typeof text !== 'string' || text.length > 4096) throw new Error('preset ต้องเป็นข้อความไม่เกิน 4KB');
    let o; try { o = JSON.parse(text); } catch (e) { throw new Error('JSON ไม่ถูกต้อง'); }
    if (!o || o.kind !== 'donate-theme') throw new Error('ไม่ใช่ preset ธีม (kind ต้องเป็น "donate-theme")');
    return sanitize(o);
  }
  const toParam = s => btoa(JSON.stringify(Object.assign({ kind: 'donate-theme', v: 1 }, sanitize(s))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromParam = p => { let b = p.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return importPreset(atob(b)); };
  function load(store, hash) {
    const m = /[?&]t=([A-Za-z0-9_-]{1,2000})/.exec(hash || '');
    if (m) { try { return fromParam(m[1]); } catch (e) {} }
    if (store) { try { const raw = store.getItem(KEY); if (raw) return importPreset(raw); } catch (e) {} }
    return sanitize(DEFAULT);
  }
  const save = (store, s) => { try { store && store.setItem(KEY, exportPreset(s)); } catch (e) {} };

  /* ---------- E: WebAudio packs (ไม่มีไฟล์เสียงภายนอก) ---------- */
  const SFX_PACKS = ['auto', 'classic', 'coin', 'laser', 'levelup'];
  const SFX_LABEL = { auto: 'อัตโนมัติตามธีม', classic: 'เสียงเดิมของระบบ', coin: '8-bit Coin', laser: 'Laser', levelup: 'Level-up' };
  const AUTO_SFX = { universal: 'coin', fps: 'laser', rpg: 'levelup', roblox: 'coin', block: 'coin', cyber: 'laser',
                     light: 'coin', horror: 'laser', space: 'levelup', persona: 'levelup', custom: 'coin' };
  const PACKS = { // [wave, freqStart, freqEnd, at(s), dur(s)] — เพิ่มชุดใหม่ได้ด้วยการเพิ่มแถว
    coin:    [['square', 988, 988, 0, 0.08], ['square', 1319, 1319, 0.08, 0.30]],
    laser:   [['sawtooth', 1400, 110, 0, 0.32], ['square', 700, 55, 0.03, 0.28]],
    levelup: [['square', 523, 523, 0, 0.09], ['square', 659, 659, 0.09, 0.09], ['square', 784, 784, 0.18, 0.09], ['square', 1047, 1047, 0.27, 0.34]]
  };
  const packFor = s => (s.sfx === 'auto' ? AUTO_SFX[s.skin] || 'coin' : s.sfx);
  function playPack(name, ctx, vol) {
    const notes = PACKS[name]; if (!notes || !ctx) return 0;
    const t0 = ctx.currentTime + 0.01, out = ctx.createGain();
    out.gain.value = Math.max(0, Math.min(1, +vol || 0)) * 0.25;
    out.connect(ctx.destination);
    let end = 0;
    for (const [type, f0, f1, at, dur] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + at;
      o.type = type; o.frequency.setValueAtTime(f0, s);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
      g.gain.setValueAtTime(1, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
      o.connect(g); g.connect(out); o.start(s); o.stop(s + dur + 0.02);
      end = Math.max(end, at + dur);
    }
    return end;
  }
  let actx = null;
  const audioCtx = () => { actx = actx || new (root.AudioContext || root.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; };
  function hookSfx(get) {
    const S = typeof SFX !== 'undefined' ? SFX : root.SFX; // eslint-disable-line no-undef
    if (!S || typeof S.hit !== 'function' || S.__uOrig) return false;
    S.__uOrig = S.hit;
    S.hit = function () {
      const pack = packFor(get());
      if (pack === 'classic') return S.__uOrig.apply(this, arguments);
      try {
        const cfg = typeof CFG !== 'undefined' ? CFG : root.CFG; // eslint-disable-line no-undef
        let v = cfg && cfg.vol != null ? +cfg.vol : 0.8; if (v > 1) v /= 100;
        playPack(pack, audioCtx(), v);
      } catch (e) { return S.__uOrig.apply(this, arguments); }
    };
    return true;
  }

  /* ---------- DOM ---------- */
  function apply(s, doc) {
    const el = doc.documentElement, vars = cssVars(s);
    for (const k in vars) el.style.setProperty(k, vars[k]);
    el.setAttribute('data-skin', s.skin);
    el.setAttribute('data-u-motion', s.motion ? 'on' : 'off');
  }
  const withTheme = (url, p) => { const [a, q = ''] = url.split('#'); const [route, qs = ''] = q.split('?');
    const sp = new URLSearchParams(qs); sp.set('t', p); return `${a}#${route}?${sp}`; };

  function mountPanel(doc, get, set) { // C + E + F UI (แสดงเฉพาะ #admin)
    if (doc.getElementById('u-theme')) return null;
    const host = doc.querySelector('#vAdmin [data-u-theme-mount]') || doc.getElementById('pS');
    if (!host) return null;
    const h = (tag, attrs, ...kids) => { const e = doc.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
      e.append(...kids); return e; };
    const step = (title, hint, ...kids) => h('div', { class: 'u-step' }, h('h3', { text: title }), h('p', { class: 'u-hint', text: hint }), ...kids);
    const toast = msg => { const t = h('div', { class: 'u-toast', role: 'status', text: msg }); doc.body.append(t); setTimeout(() => t.remove(), 2400); };
    const copy = async txt => { try { await navigator.clipboard.writeText(txt); } catch (e) {
      const ta = h('textarea'); ta.value = txt; doc.body.append(ta); ta.select(); doc.execCommand('copy'); ta.remove(); } };

    const grid = h('div', { class: 'u-grid', role: 'group', 'aria-label': 'เลือกธีม' });
    const swatches = SKINS.map(skin => { const t = tokens(sanitize({ skin }));
      const b = h('button', { type: 'button', class: 'u-sw', 'data-skin': skin, onclick: () => set({ skin }) }, h('i'), h('span', { text: NAMES[skin] }));
      b.style.setProperty('--c1', t.a1); b.style.setProperty('--c2', t.a2); grid.append(b); return b; });

    const field = (label, ctrl) => h('label', { class: 'u-field' }, h('span', { text: label }), ctrl);
    const input = (attrs, onInput) => { const i = h('input', attrs); i.addEventListener('input', () => onInput(i)); return i; };
    const iA1 = input({ type: 'color' }, i => set({ a1: i.value, skin: 'custom' }));
    const iA2 = input({ type: 'color' }, i => set({ a2: i.value, skin: 'custom' }));
    const iDepth = input({ type: 'range', min: 0, max: 8, step: 1 }, i => set({ depth: +i.value }));
    const iRad = input({ type: 'range', min: 0, max: 12, step: 1 }, i => set({ radius: +i.value }));
    const iBw = input({ type: 'range', min: 2, max: 5, step: 1 }, i => set({ bw: +i.value }));
    const iMot = input({ type: 'checkbox' }, i => set({ motion: i.checked }));
    const base = h('select', { onchange: e => set({ base: e.target.value, skin: 'custom' }) },
      h('option', { value: 'dark', text: 'พื้นมืด' }), h('option', { value: 'light', text: 'พื้นสว่าง' }));
    const badges = h('div', { class: 'u-badges', 'aria-live': 'polite' });
    const preview = h('div', { class: 'u-card u-tilt', 'aria-hidden': 'true' },
      h('div', { class: 'u-tier', text: 'NEW DONATION' }), h('b', { class: 'u-name', text: 'PlayerOne' }),
      h('div', { class: 'u-amt', text: '฿500' }), h('p', { text: 'ข้อความตัวอย่างจากผู้บริจาค GG!' }),
      h('div', { class: 'u-row' }, h('button', { type: 'button', class: 'u-btn', tabindex: '-1', text: 'ปุ่มหลัก' }),
        h('button', { type: 'button', class: 'u-btn u-btn--alt', tabindex: '-1', text: 'ปุ่มรอง' })));

    const sfx = h('select', { onchange: e => set({ sfx: e.target.value }) }, ...SFX_PACKS.map(p => h('option', { value: p, text: SFX_LABEL[p] })));
    const bTest = h('button', { type: 'button', class: 'u-btn u-btn--alt', text: '▶ ทดลองเสียง', onclick: () => {
      const p = packFor(get()), S = typeof SFX !== 'undefined' ? SFX : root.SFX; // eslint-disable-line no-undef
      if (p !== 'classic') playPack(p, audioCtx(), 0.8); else if (S && S.__uOrig) S.__uOrig.call(S, 1); else toast('ใช้เสียงเดิมของระบบ'); } });

    const io = h('textarea', { class: 'u-io', rows: '5', spellcheck: 'false', placeholder: 'วาง JSON preset ตรงนี้ แล้วกด Import' });
    const bCopy = h('button', { type: 'button', class: 'u-btn', text: 'Copy brand preset', onclick: async () => {
      const j = exportPreset(get()); io.value = j; await copy(j); toast('คัดลอกแล้ว นำไปวางที่ช่องอื่นแล้วกด Import'); } });
    const bImp = h('button', { type: 'button', class: 'u-btn u-btn--alt', text: 'Import preset', onclick: () => {
      try { set(importPreset(io.value.trim()), true); toast('นำเข้าแล้ว ✓'); } catch (e) { toast('นำเข้าไม่ได้: ' + e.message); } } });
    const bObs = h('button', { type: 'button', class: 'u-btn u-btn--alt', text: 'Copy OBS URL + ธีม', onclick: async () => {
      const found = [...doc.querySelectorAll('#vAdmin input, #vAdmin a')].map(e => e.value || e.href || '').find(v => v.includes('#overlay'));
      const p = toParam(get()); await copy(found ? withTheme(found, p) : '&t=' + p);
      toast(found ? 'คัดลอกลิงก์ OBS พร้อมธีมแล้ว' : 'ไม่พบลิงก์ overlay: คัดลอกเฉพาะ &t=… ไปต่อท้ายลิงก์ OBS'); } });

    host.append(h('section', { id: 'u-theme', 'aria-labelledby': 'u-theme-h' },
      h('h2', { id: 'u-theme-h', text: 'ธีม & แบรนด์' }),
      step('1 · เลือกธีม', 'คลิกครั้งเดียว เปลี่ยนทั้งหน้าโดเนท แอดมิน และ OBS', grid),
      step('2 · ปรับแต่ง', 'เลือกสีเองได้ ระบบคำนวณสีตัวอักษรให้อ่านง่ายอัตโนมัติ (≥ 4.5:1)',
        h('div', { class: 'u-row' }, field('สีเน้น 1 (ปุ่ม/ชื่อ)', iA1), field('สีเน้น 2 (ยอดเงิน/แถบ)', iA2), field('พื้นหลัง', base)),
        h('div', { class: 'u-row' }, field('ความลึก 3D', iDepth), field('มุมโค้ง', iRad), field('ความหนากรอบ', iBw), field('แอนิเมชัน 3D', iMot)),
        badges, preview),
      step('3 · เสียงแจ้งเตือน', 'สร้างสดด้วย WebAudio ไม่โหลดไฟล์', h('div', { class: 'u-row' }, field('ชุดเสียง', sfx), bTest)),
      step('4 · ย้ายค่าไปช่องอื่น', 'preset มีแค่ธีม/สี/เสียง ไม่มี PromptPay, relay หรือ token', io, h('div', { class: 'u-row' }, bCopy, bImp, bObs))));

    return function refresh() {
      const s = get(), t = tokens(s);
      swatches.forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.skin === s.skin));
        if (b.dataset.skin === 'custom') { b.style.setProperty('--c1', s.a1); b.style.setProperty('--c2', s.a2); } });
      iA1.value = t.a1; iA2.value = t.a2; base.value = t.base || 'dark';
      iDepth.value = s.depth; iRad.value = s.radius; iBw.value = s.bw; iMot.checked = s.motion; sfx.value = s.sfx;
      badges.replaceChildren(...[['ตัวอักษรบนปุ่ม 1', t.onA1, t.a1], ['ตัวอักษรบนปุ่ม 2', t.onA2, t.a2],
        ['ชื่อบนการ์ด', t.a1Text, t.surface], ['ยอดเงิน', t.a2Text, t.surface], ['ข้อความ', t.ink, t.surface]].map(([n, f, b]) => {
        const r = contrast(f, b); return h('span', { class: 'u-badge' + (r < 4.5 ? ' bad' : ''), text: `${n} ${r.toFixed(1)}:1 ${r >= 4.5 ? '✓' : '✗'}` }); }));
    };
  }

  const API = { KEY, contrast, onColor, ensureContrast, tokens, cssVars, sanitize, exportPreset, importPreset, toParam, fromParam,
                playPack, packFor, PRESETS, SKINS, SFX_PACKS, AUTO_SFX, DEFAULT };

  if (typeof document !== 'undefined' && typeof location !== 'undefined') {
    const doc = document, isOverlay = () => /^#(overlay|obs)/.test(location.hash);
    let state = load(root.localStorage, location.hash), refresh = null;
    const get = () => state;
    const set = (patch, replace) => { state = sanitize(replace ? patch : Object.assign({}, state, patch));
      if (!isOverlay()) save(root.localStorage, state); apply(state, doc); refresh && refresh(); };
    doc.documentElement.classList.toggle('u-overlay', isOverlay());
    apply(state, doc);
    const route = () => {
      doc.documentElement.classList.toggle('u-overlay', isOverlay());
      hookSfx(get);
      if (/^#admin/.test(location.hash) && !refresh) refresh = mountPanel(doc, get, set);
      refresh && refresh();
    };
    doc.readyState === 'loading' ? doc.addEventListener('DOMContentLoaded', route) : route();
    root.addEventListener('hashchange', route);
    root.addEventListener('storage', e => { if (e.key === KEY) { state = load(root.localStorage, location.hash); apply(state, doc); refresh && refresh(); } });
    root.UTheme = Object.assign({}, API, { get, set });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
// @u-theme-end