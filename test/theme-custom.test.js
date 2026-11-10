const assert = require('node:assert/strict'), T = require('../tools/brand.js');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
const rng = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(1337);
const rhex = () => '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');

check('ดำบนเหลือง', () => assert.equal(T.onColor('#ffcc00'), '#000000'));
check('ขาวบนน้ำเงินเข้ม', () => assert.equal(T.onColor('#1d2a6b'), '#ffffff'));
check('ensureContrast ไม่แตะสีที่ผ่านแล้ว', () => assert.equal(T.ensureContrast('#ffffff', '#000000'), '#ffffff'));
check('ensureContrast แก้เหลืองบนขาว', () => assert.ok(T.contrast(T.ensureContrast('#ffee00', '#ffffff'), '#ffffff') >= 4.5));

const fails = { onA1: [], onA2: [], a1Text: [], a2Text: [], fill: [] };
for (let i = 0; i < 400; i++) {
  const a1 = rhex(), a2 = rhex(), base = i % 2 ? 'light' : 'dark';
  const t = T.tokens(T.sanitize({ skin: 'custom', a1, a2, base }));
  if (T.contrast(t.onA1, t.a1) < 4.5) fails.onA1.push(a1);
  if (T.contrast(t.onA2, t.a2) < 4.5) fails.onA2.push(a2);
  if (T.contrast(t.a1Text, t.surface) < 4.5) fails.a1Text.push(a1 + '/' + base);
  if (T.contrast(t.a2Text, t.surface) < 4.5) fails.a2Text.push(a2 + '/' + base);
  if (t.a1 !== a1 || t.a2 !== a2) fails.fill.push(a1);
}
for (const k of Object.keys(fails)) check(`400 สีสุ่ม: ${k}`, () => assert.deepEqual(fails[k], []));
check('cssVars ครบทุก token', () => {
  const v = T.cssVars(T.sanitize({ skin: 'custom' }));
  for (const k of ['--u-a1','--u-a2','--u-on-a1','--u-on-a2','--u-a1-text','--u-a2-text','--u-halo','--u-depth','--u-radius','--u-bw']) assert.ok(v[k], k);
});
console.log(`theme-custom: ${n} checks passed`);