// Persona skin: Thai labels must not wrap/clip in the amount chips or the "สร้าง QR" button. Run: node test/p5-donor-fit.test.js
// Source-level (jsdom has no layout); real-Chrome widths 320/360/390/768/1280 were measured when this fix landed.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(root, 'tools/p5.css'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
const rule = (sel) => { const m = CSS.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[1] : ''; };

const chipRules = CSS.match(/html\[data-skin="persona"\] \.chip\{[^}]*\}/g) || [];
const chip = chipRules.join(' ');
ok(/white-space:nowrap/.test(chip), 'chip never wraps its amount onto a second line');
ok(/letter-spacing:\.0\d+em/.test(chip), 'chip letter-spacing is reduced (was .14em, too wide for Thai/amounts)');
ok(/font-size:clamp\(/.test(chip), 'chip font scales with viewport');
const gen = rule('html[data-skin="persona"] #bGen');
ok(/white-space:nowrap/.test(gen), 'generate-QR button label stays on one line');
ok(/font-size:clamp\(\.95rem,[^)]*vw,[^)]*rem\)!important/.test(gen), 'generate-QR font scales down to 320px phones (overrides the fixed !text-[1.7rem])');
ok(/overflow:visible/.test(gen), 'generate-QR button no longer clips its label');
ok(/html\[data-skin="persona"\] \.chip\{white-space:nowrap/.test(HTML) || /\.chip\{white-space:nowrap/.test(HTML), 'fix is embedded in index.html');
// scoped to the persona skin only: no bare .chip / #bGen rules were added
const added = CSS.slice(CSS.indexOf('/* fix: ข้อความไทยกว้างกว่าละติน'), CSS.indexOf('/* fix: ข้อความไทยกว้างกว่าละติน') + 700);
ok(!/(^|\n)(\.chip|#bGen)\s*\{/.test(added), 'fix is scoped to html[data-skin="persona"] (other themes untouched)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
