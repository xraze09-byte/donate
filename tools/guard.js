// @guard-start — Donation Guard: sanitize, validate, honeypot, CSRF token, link filter, payload integrity.
// ADDITIVE ONLY: ไม่แก้ SHIELD / SPAM / socket / TTS / queue / SLIPH เดิม — ทำงานเป็นด่านเสริมก่อนและหลังของเดิม
(function (root) {
  'use strict';

  /* ---------- 1) sanitize: ตัดเป็นข้อความล้วน ไม่มีทางกลายเป็น DOM ---------- */
  const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g; // control + zero-width + bidi override
  const TAGS = /<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi;
  function cleanText(v, max) {
    let s = String(v == null ? '' : v);
    try { s = s.normalize('NFKC'); } catch (e) { /* ok */ }
    s = s.replace(CTRL, '').replace(TAGS, ' ').replace(/<[^>]*>?/g, ' ')
         .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, ' ')            // entity อำพราง เช่น &lt;script&gt;
         .replace(/(?:javascript|data|vbscript)\s*:/gi, ' ')     // scheme อันตราย
         .replace(/\bon[a-z]{3,}\s*=/gi, ' ')                    // onerror= onclick=
         .replace(/[<>`]/g, ' ')
         .replace(/\s+/g, ' ').trim();
    return max ? Array.from(s).slice(0, max).join('') : s;      // นับเป็นตัวอักษร ไม่ตัดกลาง surrogate/วรรณยุกต์ไทย
  }
  // escape สำหรับกรณีจำเป็นต้องใส่ลง innerHTML (เช่น ticker เดิม) — ใช้คู่กับ cleanText
  const escapeHtml = v => String(v == null ? '' : v).replace(/[&<>"'`=\/]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' }[c]));

  /* ---------- 2) ตัวกรองลิงก์/URL (ตั้งค่าได้) ---------- */
  const DEFAULT_LINK = { on: true, mode: 'block', allow: [] };   // mode: 'block' = เปลี่ยนเป็น [ลิงก์ถูกซ่อน] | 'drop' = ทิ้งทั้งข้อความ
  const URLISH = new RegExp([
    '\\b(?:https?|ftp|wss?|file)\\s*:?\\s*\\/\\/\\S+',                      // http://… (รวมแบบเว้นวรรค)
    '\\bwww\\s*\\.\\s*[a-z0-9-]+(?:\\s*\\.\\s*[a-z0-9-]+)+\\S*',            // www . x . com
    '\\b[a-z0-9-]{2,}(?:\\s*(?:\\.|\\[\\.\\]|\\(dot\\)|\\sdot\\s)\\s*)(?:com|net|org|io|co|th|me|ly|gg|tv|xyz|top|ru|cn|info|biz|app|dev|link|click|live|shop|site|online)\\b(?:\\/\\S*)?',
    '\\b(?:bit\\.ly|t\\.co|tinyurl\\.com|discord\\.gg|line\\.me|lin\\.ee|t\\.me|wa\\.me)\\/\\S*',
    '\\b\\d{1,3}(?:\\.\\d{1,3}){3}(?::\\d+)?(?:\\/\\S*)?',                      // IPv4
    '(?:^|\\s)@[a-z0-9_.]{3,}\\b.*\\b(?:ig|fb|line|tele|ไลน์)\\b'                // ชวนทักไปช่องอื่น
  ].join('|'), 'gi');
  function linkConfig(store) {
    let c = {}; try { c = JSON.parse((store && store.getItem('rzc_guard_links')) || '{}') || {}; } catch (e) { /* ok */ }
    const allow = String(c.allow || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    return { on: c.on !== false, mode: c.mode === 'drop' ? 'drop' : 'block', allow: allow.length ? allow : DEFAULT_LINK.allow };
  }
  function hasLink(text, cfg) {
    cfg = cfg || DEFAULT_LINK; if (!cfg.on) return false;
    const t = cleanText(text);
    URLISH.lastIndex = 0;
    let m = t.match(URLISH);
    if (!m) { // กันแบบแยกตัวอักษรทีละตัว: "h t t p : / / x . y" → เทียบรูปที่บีบช่องว่างออก (เฉพาะเมื่อมีสัญญาณ scheme/จุด)
      const sq = t.replace(/\s+/g, '');
      if (/(?:https?|ftp|wss?)[:;]\/\//i.test(sq) || /www\.[a-z0-9-]+\./i.test(sq)) { URLISH.lastIndex = 0; m = sq.match(URLISH); }
    }
    if (!m) return false;
    return m.some(x => !cfg.allow.some(a => x.toLowerCase().includes(a)));
  }
  function stripLinks(text, cfg) {
    cfg = cfg || DEFAULT_LINK; const t = cleanText(text);
    if (!cfg.on) return t;
    URLISH.lastIndex = 0;
    if (cfg.mode === 'drop' && hasLink(t, cfg)) return '';
    if (hasLink(t, cfg) && !URLISH.test(t)) { URLISH.lastIndex = 0; return '[ลิงก์ถูกซ่อน]'; } // ลิงก์ที่ซ่อนด้วยช่องว่าง: ทิ้งทั้งข้อความแทนเดา
    URLISH.lastIndex = 0;
    return t.replace(URLISH, x => (cfg.allow.some(a => x.toLowerCase().includes(a)) ? x : '[ลิงก์ถูกซ่อน]')).replace(/\s+/g, ' ').trim();
  }

  /* ---------- 3) ตัวเลขยอดเงิน ---------- */
  const AMT = { min: 1, max: 1000000, decimals: 2 };
  function parseAmount(v, opt) {
    const o = Object.assign({}, AMT, opt || {});
    if (typeof v === 'number') { if (!Number.isFinite(v)) return { ok: false, why: 'ไม่ใช่ตัวเลข' }; }
    else if (typeof v === 'string') {
      const t = v.trim();
      const plain = /^\d{1,9}(?:\.\d{1,2})?$/.test(t), grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(t); // คอมมาต้องเป็นหลักพันจริงเท่านั้น
      if (!plain && !grouped) return { ok: false, why: 'รูปแบบตัวเลขไม่ถูกต้อง' };
    }
    else return { ok: false, why: 'ไม่ใช่ตัวเลข' };
    const n = typeof v === 'number' ? v : Number(v.replace(/,/g, ''));
    if (!(n >= o.min)) return { ok: false, why: 'ขั้นต่ำ ' + o.min };
    if (n > o.max) return { ok: false, why: 'สูงสุด ' + o.max };
    const k = Math.pow(10, o.decimals);
    if (Math.abs(n * k - Math.round(n * k)) > 1e-6) return { ok: false, why: 'ทศนิยมไม่เกิน ' + o.decimals + ' ตำแหน่ง' };
    return { ok: true, value: Math.round(n * k) / k };
  }

  /* ---------- 4) token / honeypot / เวลากรอก ---------- */
  function rand(len) {
    const a = new Uint8Array(len), c = root.crypto;
    if (c && c.getRandomValues) c.getRandomValues(a); else for (let i = 0; i < len; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  // CSRF-style token: สุ่มใหม่ทุกครั้งที่โหลดฟอร์ม ใช้ได้ครั้งเดียว หมดอายุ 30 นาที เก็บใน sessionStorage (ผูกกับแท็บ)
  const CSRF_KEY = 'rzc_csrf', CSRF_TTL = 30 * 60 * 1000;
  function issueToken(store, now) {
    const t = { v: rand(16), at: now || Date.now() };
    try { store.setItem(CSRF_KEY, JSON.stringify(t)); } catch (e) { /* ok */ }
    return t.v;
  }
  function consumeToken(store, presented, now) {
    let t = null; try { t = JSON.parse(store.getItem(CSRF_KEY) || 'null'); } catch (e) { /* ok */ }
    try { store.removeItem(CSRF_KEY); } catch (e) { /* ok */ }              // ใช้ได้ครั้งเดียวไม่ว่าผลเป็นอย่างไร
    if (!t || typeof presented !== 'string' || presented.length !== 32) return false;
    if (((now || Date.now()) - t.at) > CSRF_TTL) return false;
    let d = 0; for (let i = 0; i < 32; i++) d |= presented.charCodeAt(i) ^ t.v.charCodeAt(i);   // constant-time
    return d === 0;
  }
  // honeypot: ช่องที่คนมองไม่เห็น ถ้ามีค่า = บอท ; MIN_FILL = กรอกเร็วเกินคนจริง
  const MIN_FILL_MS = 1200;
  function botCheck(o, now) {
    o = o || {}; now = now || Date.now();
    if (o.honeypot && String(o.honeypot).trim() !== '') return { bot: true, why: 'honeypot' };
    if (o.shownAt && now - o.shownAt < MIN_FILL_MS) return { bot: true, why: 'too-fast' };
    return { bot: false };
  }

  /* ---------- 5) cooldown เสริม (client) — คนละ key กับ SPAM เดิม ไม่แก้ของเดิม ---------- */
  const CD_KEY = 'rzc_guard_cd';
  function cooldown(store, now, ms, burst, windowMs) {
    ms = ms || 8000; burst = burst || 5; windowMs = windowMs || 600000; now = now || Date.now();
    let a = []; try { a = JSON.parse(store.getItem(CD_KEY) || '[]') || []; } catch (e) { /* ok */ }
    a = a.filter(t => typeof t === 'number' && now - t < windowMs);
    if (a.length && now - a[a.length - 1] < ms) return { ok: false, wait: Math.ceil((ms - (now - a[a.length - 1])) / 1000) };
    if (a.length >= burst) return { ok: false, wait: Math.ceil((windowMs - (now - a[0])) / 1000) };
    return { ok: true, mark() { a.push(now); try { store.setItem(CD_KEY, JSON.stringify(a)); } catch (e) { /* ok */ } } };
  }

  /* ---------- 6) payload integrity ก่อนขึ้นจอ ----------
     ไม่มี secret ฝั่งเบราว์เซอร์ที่ปลอดภัยจริง (ซอร์สเป็นสาธารณะ) → ใช้ "โครงสร้าง + ขอบเขต + fingerprint"
     ป้องกัน payload เพี้ยน/ถูกยัดฟิลด์แปลก/เกินขอบเขต ส่วนการพิสูจน์ต้นทาง (admin-only alert) ทำที่ relay */
  const ALLOWED = ['name', 'amount', 'message', 'force', 'ed', 'tier', 'ts', 'id'];
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  const fingerprint = d => fnv([cleanText(d.name, 40), Number(d.amount), cleanText(d.message, 200)].join('\u241F'));
  function verifyAlert(d, opt) {
    opt = opt || {};
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, why: 'not-object' };
    if (Object.getPrototypeOf(d) !== Object.prototype && Object.getPrototypeOf(d) !== null) return { ok: false, why: 'bad-proto' };
    for (const k of Object.keys(d)) if (k === '__proto__' || k === 'constructor' || k === 'prototype') return { ok: false, why: 'proto-key' };
    for (const k of ['name', 'message']) if (d[k] != null && typeof d[k] !== 'string') return { ok: false, why: 'bad-type:' + k };
    const a = parseAmount(d.amount, { min: 0.01, max: 99999999, decimals: 2 });
    if (!a.ok) return { ok: false, why: 'amount' };
    if (String(d.name || '').length > 400 || String(d.message || '').length > 2000) return { ok: false, why: 'too-long' };
    if (opt.maxAgeMs && d.ts && Math.abs((opt.now || Date.now()) - Number(d.ts)) > opt.maxAgeMs) return { ok: false, why: 'stale' };
    const clean = {
      name: cleanText(d.name, 40) || 'ANONYMOUS', amount: a.value,
      message: cleanText(d.message, 200)
    };
    for (const k of ALLOWED) if (!(k in clean) && d[k] !== undefined && (k === 'force' || k === 'ed')) clean[k] = !!d[k];
    return { ok: true, clean, fp: fingerprint(clean) };
  }
  // เทียบ fingerprint ที่ฝั่งส่งแนบมา (ถ้ามี) กับที่คำนวณซ้ำ — ไม่ตรง = ถูกแก้กลางทาง
  const matches = (d, fp) => typeof fp !== 'string' || fingerprint(d) === fp;

  /* ---------- 7) tier สำหรับ alert (ตั้งค่าได้) ---------- */
  const TIERS = { mega: 1000, big: 300 };
  const tierFor = (amount, t) => { t = t || TIERS; const n = Number(amount) || 0; return n >= t.mega ? 'mega' : n >= t.big ? 'big' : 'std'; };

  const API = { cleanText, escapeHtml, hasLink, stripLinks, linkConfig, parseAmount, issueToken, consumeToken, botCheck, cooldown,
                verifyAlert, fingerprint, matches, tierFor, MIN_FILL_MS, TIERS, AMT, CSRF_TTL };
  root.DonationGuard = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
// @guard-end
