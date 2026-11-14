const assert = require('node:assert/strict'), T = require('../tools/brand.js');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
const s = T.sanitize({ skin: 'custom', a1: '#FF7A00', a2: '#00e5a8', depth: 6, radius: 4, bw: 4, motion: false, sfx: 'laser' });

check('export → import ได้ค่าเดิม', () => assert.deepEqual(T.importPreset(T.exportPreset(s)), s));
check('URL param ไป-กลับ', () => assert.deepEqual(T.fromParam(T.toParam(s)), s));
check('param ปลอดภัยใน URL', () => assert.match(T.toParam(s), /^[A-Za-z0-9_-]+$/));
check('hex เป็นตัวเล็ก', () => assert.equal(s.a1, '#ff7a00'));
check('ปฏิเสธ JSON เสีย', () => assert.throws(() => T.importPreset('{nope')));
check('ปฏิเสธ kind ผิด', () => assert.throws(() => T.importPreset('{"kind":"x"}')));
check('ปฏิเสธเกิน 4KB', () => assert.throws(() => T.importPreset(' '.repeat(5000))));
check('ไม่พา secret ไปด้วย', () => {
  const o = T.importPreset(JSON.stringify({ kind: 'donate-theme', pp: '0812345678', ws: 'wss://x', token: 'abc', RELAY_TOKEN: 'z' }));
  for (const k of ['pp', 'ws', 'token', 'RELAY_TOKEN']) assert.ok(!(k in o), k);
  assert.doesNotMatch(T.exportPreset(o), /0812345678|wss:|abc/);
});
check('กัน prototype pollution', () => {
  T.importPreset('{"kind":"donate-theme","__proto__":{"polluted":1}}'); assert.equal({}.polluted, undefined);
});
check('สีผิดรูปแบบใช้ค่าเริ่มต้น', () => assert.equal(T.importPreset('{"kind":"donate-theme","a1":"red"}').a1, T.DEFAULT.a1));
check('ตัวเลขถูกจำกัดช่วง', () => {
  const o = T.importPreset('{"kind":"donate-theme","depth":99,"radius":-5,"bw":"x"}');
  assert.equal(o.depth, 8); assert.equal(o.radius, 0); assert.equal(o.bw, T.DEFAULT.bw);
});
check('ธีมที่ไม่รู้จัก → ค่าเริ่มต้น (persona)', () => assert.equal(T.importPreset('{"kind":"donate-theme","skin":"evil"}').skin, 'persona'));
console.log(`preset-io: ${n} checks passed`);