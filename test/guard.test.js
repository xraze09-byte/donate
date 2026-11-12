// Donation Guard: sanitize / validate / honeypot / CSRF / link filter / payload integrity. Run: node test/guard.test.js
const assert = require('node:assert/strict'), G = require('../tools/guard.js');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); process.exitCode = 1; } };
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };

/* ---- XSS / DOM injection ---- */
const ATTACKS = [
  '<script>alert(1)</script>hi', '<img src=x onerror=alert(1)>', '<svg/onload=alert(1)>', '"><iframe src=javascript:alert(1)>',
  '&lt;script&gt;alert(1)&lt;/script&gt;', 'javascript:alert(1)', 'JaVaScRiPt : alert(1)', '<a href="data:text/html,x">k</a>',
  '<style>*{display:none}</style>x', '`${alert(1)}`', '<math><mi xlink:href="javascript:alert(1)">', 'x onmouseover=alert(1) y'
];
for (const a of ATTACKS) check('cleanText ปลอดภัย: ' + a.slice(0, 32), () => {
  const o = G.cleanText(a, 200);
  assert.doesNotMatch(o, /[<>`]/); assert.doesNotMatch(o, /javascript\s*:|data\s*:|vbscript\s*:/i);
  assert.doesNotMatch(o, /\bon[a-z]{3,}\s*=/i); assert.doesNotMatch(o, /&(lt|gt|#)/i);
});
check('cleanText ลบ zero-width + bidi override', () => assert.equal(G.cleanText('a\u200Bb\u202Ec\u0000d'), 'abcd'));
check('cleanText คงข้อความไทย + วรรณยุกต์', () => assert.equal(G.cleanText('สวัสดีครับ ขอบคุณที่สตรีม'), 'สวัสดีครับ ขอบคุณที่สตรีม'));
check('cleanText จำกัดความยาวเป็นตัวอักษร ไม่ตัดกลางอีโมจิ', () => assert.equal(G.cleanText('😀😀😀😀', 2), '😀😀'));
check('cleanText รับ null/undefined/ตัวเลข', () => { assert.equal(G.cleanText(null), ''); assert.equal(G.cleanText(undefined), ''); assert.equal(G.cleanText(42), '42'); });
check('escapeHtml escape ครบ', () => assert.equal(G.escapeHtml('<a href="x" onclick=\'y\'>&`'), '&lt;a href&#61;&quot;x&quot; onclick&#61;&#39;y&#39;&gt;&amp;&#96;'));

/* ---- amount ---- */
const bad = [NaN, Infinity, -Infinity, -5, 0, 0.5, '', 'abc', '1e5', '0x10', '1,00,0,0', null, undefined, {}, [], '12.345', 1000001, '9999999999', true];
for (const b of bad) check('amount ปฏิเสธ ' + JSON.stringify(b) + ' (' + typeof b + ')', () => assert.equal(G.parseAmount(b).ok, false));
check('amount รับ 1 / 100 / 1,000 / 12.50 / 1000000', () => { for (const v of [1, 100, '1,000', '12.50', 1000000]) assert.equal(G.parseAmount(v).ok, true, String(v)); });
check('amount ปัดเป็น 2 ตำแหน่ง', () => assert.equal(G.parseAmount('12.50').value, 12.5));
check('amount ตั้ง min/max เองได้', () => { assert.equal(G.parseAmount(5, { min: 10 }).ok, false); assert.equal(G.parseAmount(50, { max: 20 }).ok, false); });

/* ---- link filter ---- */
const LINKS = ['เข้ามาดู http://evil.com/x', 'https://bit.ly/abc', 'www.scam.top', 'evil.com', 'evil [.] com/p', 'evil(dot)com', 'scam dot com', 'discord.gg/xyz', 'line.me/ti/p/abc', 'ไปที่ 192.168.1.1:8080/login', 'h t t p : / / x . y', 'ftp://x.y/z'];
for (const l of LINKS) check('ตรวจพบลิงก์: ' + l, () => assert.equal(G.hasLink(l), true));
const CLEAN = ['สู้ๆ นะครับ', 'GG well played', 'ขอบคุณ 100 บาท', 'ฮาๆๆ 5555', 'เล่นเกมนี้สนุกมาก v2.0', 'wow!!!'];
for (const c of CLEAN) check('ไม่เหมาจับข้อความปกติ: ' + c, () => assert.equal(G.hasLink(c), false));
check('stripLinks โหมด block แทนที่ด้วยข้อความ', () => assert.equal(G.stripLinks('ดูนี่ http://evil.com/x นะ'), 'ดูนี่ [ลิงก์ถูกซ่อน] นะ'));
check('stripLinks โหมด drop ทิ้งทั้งข้อความ', () => assert.equal(G.stripLinks('ดูนี่ http://evil.com', { on: true, mode: 'drop', allow: [] }), ''));
check('stripLinks ปิดได้ (on:false)', () => assert.match(G.stripLinks('http://x.com', { on: false, mode: 'block', allow: [] }), /x\.com/));
check('allowlist ปล่อยโดเมนที่อนุญาต', () => assert.equal(G.hasLink('twitch.tv/mychannel', { on: true, mode: 'block', allow: ['twitch.tv'] }), false));
check('allowlist ไม่ปล่อยโดเมนอื่น', () => assert.equal(G.hasLink('evil.com twitch.tv', { on: true, mode: 'block', allow: ['twitch.tv'] }), true));
check('linkConfig อ่านค่าจาก storage', () => { const s = mem(); s.setItem('rzc_guard_links', JSON.stringify({ on: true, mode: 'drop', allow: 'a.com, b.com' })); const c = G.linkConfig(s); assert.equal(c.mode, 'drop'); assert.deepEqual(c.allow, ['a.com', 'b.com']); });
check('linkConfig ทนค่าพัง', () => { const s = mem(); s.setItem('rzc_guard_links', '{not json'); assert.equal(G.linkConfig(s).on, true); });

/* ---- CSRF token ---- */
check('token ออกใหม่ 32 hex', () => assert.match(G.issueToken(mem()), /^[0-9a-f]{32}$/));
check('token ใช้ได้ครั้งเดียว', () => { const s = mem(), t = G.issueToken(s); assert.equal(G.consumeToken(s, t), true); assert.equal(G.consumeToken(s, t), false); });
check('token ผิด = ปฏิเสธ และถูกเผา', () => { const s = mem(), t = G.issueToken(s); assert.equal(G.consumeToken(s, 'x'.repeat(32)), false); assert.equal(G.consumeToken(s, t), false); });
check('token หมดอายุ 30 นาที', () => { const s = mem(), t0 = 1e12, t = G.issueToken(s, t0); assert.equal(G.consumeToken(s, t, t0 + G.CSRF_TTL + 1), false); });
check('token ไม่มี/ชนิดผิด = ปฏิเสธ', () => { const s = mem(); assert.equal(G.consumeToken(s, undefined), false); G.issueToken(s); assert.equal(G.consumeToken(s, 123), false); });
check('สองครั้งได้ token ต่างกัน', () => assert.notEqual(G.issueToken(mem()), G.issueToken(mem())));

/* ---- honeypot / bot ---- */
check('honeypot มีค่า = บอท', () => assert.deepEqual(G.botCheck({ honeypot: 'http://x', shownAt: 0 }, 1e6), { bot: true, why: 'honeypot' }));
check('กรอกเร็วเกิน = บอท', () => assert.equal(G.botCheck({ honeypot: '', shownAt: 1000 }, 1500).bot, true));
check('คนจริง (ว่าง + ช้าพอ) ผ่าน', () => assert.equal(G.botCheck({ honeypot: '', shownAt: 1000 }, 1000 + G.MIN_FILL_MS + 1).bot, false));
check('honeypot ช่องว่างล้วนไม่นับ', () => assert.equal(G.botCheck({ honeypot: '   ', shownAt: 0 }, 1e6).bot, false));

/* ---- cooldown ---- */
check('cooldown ครั้งแรกผ่าน', () => assert.equal(G.cooldown(mem(), 1e6).ok, true));
check('cooldown ถี่เกิน = ปฏิเสธพร้อมเวลารอ', () => { const s = mem(), c = G.cooldown(s, 1e6); c.mark(); const r = G.cooldown(s, 1e6 + 3000); assert.equal(r.ok, false); assert.equal(r.wait, 5); });
check('cooldown ผ่านหลังพ้นเวลา', () => { const s = mem(); G.cooldown(s, 1e6).mark(); assert.equal(G.cooldown(s, 1e6 + 9000).ok, true); });
check('cooldown จำกัด burst ต่อหน้าต่างเวลา', () => { const s = mem(); let t = 1e6; for (let i = 0; i < 5; i++) { G.cooldown(s, t).mark(); t += 9000; } assert.equal(G.cooldown(s, t).ok, false); });
check('cooldown ทนข้อมูลพัง', () => { const s = mem(); s.setItem('rzc_guard_cd', 'zzz'); assert.equal(G.cooldown(s, 1e6).ok, true); });

/* ---- payload integrity ---- */
const good = { name: 'Player', amount: 500, message: 'GG' };
check('verifyAlert รับ payload ปกติ', () => { const r = G.verifyAlert(good); assert.equal(r.ok, true); assert.equal(r.clean.amount, 500); });
check('verifyAlert ล้าง XSS ใน name/message', () => { const r = G.verifyAlert({ name: '<img onerror=x>Bob', amount: 10, message: '<script>1</script>hi' }); assert.equal(r.ok, true); assert.doesNotMatch(r.clean.name + r.clean.message, /[<>]/); });
for (const [label, p] of [['null', null], ['array', []], ['string', 'x'], ['amount ลบ', { name: 'a', amount: -1 }], ['amount NaN', { name: 'a', amount: NaN }],
  ['amount string แปลก', { name: 'a', amount: '1e9' }], ['name เป็น object', { name: { x: 1 }, amount: 5 }], ['message เป็น array', { name: 'a', amount: 5, message: ['x'] }],
  ['ยาวเกิน', { name: 'a'.repeat(401), amount: 5 }], ['เกินเพดาน', { name: 'a', amount: 1e9 }]])
  check('verifyAlert ปฏิเสธ ' + label, () => assert.equal(G.verifyAlert(p).ok, false));
check('verifyAlert ปฏิเสธ __proto__ key', () => assert.equal(G.verifyAlert(JSON.parse('{"name":"a","amount":5,"__proto__":{"x":1}}')).ok, false));
check('verifyAlert ปฏิเสธ object ที่ proto ไม่ใช่ Object', () => assert.equal(G.verifyAlert(Object.create({ evil: 1 }, { amount: { value: 5, enumerable: true } })).ok, false));
check('verifyAlert ตัดฟิลด์แปลกทิ้ง', () => { const r = G.verifyAlert({ name: 'a', amount: 5, evil: '<x>', html: '<b>' }); assert.equal(r.ok, true); assert.equal('evil' in r.clean, false); assert.equal('html' in r.clean, false); });
check('verifyAlert ปฏิเสธ payload เก่าเกินกำหนด', () => assert.equal(G.verifyAlert({ name: 'a', amount: 5, ts: 1000 }, { maxAgeMs: 60000, now: 1e9 }).ok, false));
check('fingerprint เสถียร', () => assert.equal(G.fingerprint(good), G.fingerprint({ ...good })));
check('fingerprint เปลี่ยนเมื่อยอดถูกแก้', () => assert.notEqual(G.fingerprint(good), G.fingerprint({ ...good, amount: 501 })));
check('matches: ตรงกัน/ถูกแก้/ไม่มี fp', () => { const fp = G.fingerprint(good); assert.equal(G.matches(good, fp), true); assert.equal(G.matches({ ...good, amount: 999 }, fp), false); assert.equal(G.matches(good, undefined), true); });

/* ---- tier ---- */
check('tierFor std/big/mega', () => { assert.equal(G.tierFor(50), 'std'); assert.equal(G.tierFor(300), 'big'); assert.equal(G.tierFor(1000), 'mega'); assert.equal(G.tierFor('abc'), 'std'); });
check('tierFor ปรับเกณฑ์เองได้', () => assert.equal(G.tierFor(50, { mega: 50, big: 10 }), 'mega'));

console.log(`guard: ${n} checks passed`);
