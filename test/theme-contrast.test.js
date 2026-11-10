const assert = require('node:assert/strict'), T = require('../tools/brand.js');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
const PAIRS = [['ink','bg'],['ink','surface'],['muted','surface'],['muted','bg'],['a1Text','surface'],['a2Text','surface'],['onA1','a1'],['onA2','a2'],['halo','ink']];

check('WCAG ดำ/ขาว = 21', () => assert.equal(T.contrast('#000000', '#ffffff').toFixed(2), '21.00'));
check('WCAG #777 บนขาว = 4.48', () => assert.equal(T.contrast('#777777', '#ffffff').toFixed(2), '4.48'));
check('มี horror', () => assert.ok(T.PRESETS.horror));
check('มี space', () => assert.ok(T.PRESETS.space));
for (const skin of Object.keys(T.PRESETS)) {
  const t = T.tokens(T.sanitize({ skin }));
  for (const [f, b] of PAIRS) check(`${skin} ${f}/${b}`, () => {
    const r = T.contrast(t[f], t[b]); assert.ok(r >= 4.5, `${t[f]} บน ${t[b]} = ${r.toFixed(2)}`); });
}
for (const skin of ['horror', 'space']) {
  const t = T.tokens(T.sanitize({ skin }));
  check(`${skin} สีเน้นผ่านโดยไม่ต้องปรับ`, () => { assert.equal(t.a1Text, t.a1); assert.equal(t.a2Text, t.a2); });
}
console.log(`theme-contrast: ${n} checks passed`);