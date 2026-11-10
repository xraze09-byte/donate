// A11y regression: admin slider labels, skip-link and tiny UI text. Run: node test/a11y-contrast.test.js
const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const lin=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const lum=h=>{const n=parseInt(h.slice(1),16);return .2126*lin(n>>16&255)+.7152*lin(n>>8&255)+.0722*lin(n&255)};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const rule=sel=>{const i=HTML.indexOf(sel+'{');if(i<0)return '';return HTML.slice(i,HTML.indexOf('}',i)+1)};

// 1) .nf-sl (admin MASTER VOLUME / VOICE PITCH / VOICE SPEED) on the dark panel
const sl=rule('.nf-sl');const col=(sl.match(/color:(#[0-9a-f]{6})/i)||[])[1];
ok(!!col,'.nf-sl has a hex colour');
ok(col&&cr(col,'#0b0e13')>=4.5,'.nf-sl contrast on dark panel >= 4.5:1 (was 2.73:1 with #4d5865), got '+(col?cr(col,'#0b0e13').toFixed(2):'n/a'));
ok(!/#4d5865/i.test(sl),'.nf-sl no longer uses the 2.73:1 grey');
const fs1=parseFloat((sl.match(/font-size:([\d.]+)rem/)||[])[1]);
ok(fs1*16>=11,'.nf-sl font-size >= 11px (was 9.6px), got '+fs1*16);

// 2) skip-link: white on --primary-accent-active must be >= 4.5 in light AND dark
const skip=rule('#rzdsSkip');
ok(/background:var\(--primary-accent-active\)/.test(skip),'skip-link uses --primary-accent-active background');
ok(/color:#fff/.test(skip),'skip-link text is white');
const actives=[...HTML.matchAll(/--primary-accent-active:(#[0-9a-f]{6})/gi)].map(m=>m[1]);
ok(actives.length>=2,'found light+dark --primary-accent-active values');
actives.forEach(c=>ok(cr('#ffffff',c)>=4.5,'white on '+c+' >= 4.5:1 ('+cr('#ffffff',c).toFixed(2)+')'));
ok(!/\.\.\.|--primary-accent\);\s*color:var\(--text-on-accent\); border-radius:var\(--radius-md\); text-decoration:none;\s*font-size:var\(--text-sm\)/.test(skip),'skip-link no longer uses the 3.77:1 dark-mode pair');

// 3) tiny-text floor in the source of truth (utility classes + .tag), 0.69rem = 11.04px
const tw=HTML.slice(HTML.indexOf('<style id="tw-static">'));
['.5','.52','.54','.56','.58'].forEach(k=>{
 const m=tw.match(new RegExp('text-\\\\\\[\\\\'+k.replace('.','\\.')+'rem\\\\\\]\\{font-size:([\\d.]+)rem\\}'));
 ok(m&&parseFloat(m[1])*16>=11,'utility text-['+k+'rem] floors at >= 11px, got '+(m?parseFloat(m[1])*16:'missing'));
});
const tagRules=[...HTML.matchAll(/(^|\n)\.tag\{[^}]*\}/g)].map(m=>m[0]);
ok(tagRules.length>=2&&tagRules.every(r=>{const f=r.match(/font-size:([\d.]+)rem/);return !f||parseFloat(f[1])*16>=11}),'.tag base rules floor at >= 11px');

// 4) OBS alert card sizing untouched (rule 4): the original sizes are still present
ok(/\.ac-t\{[^}]*font-size:clamp\(\.54rem,1\.6vw,\.76rem\)/.test(HTML),'OBS .ac-t size unchanged');
ok(/\.ac-tier\{[^}]*font-size:clamp\(\.6rem,1\.8vw,\.88rem\)/.test(HTML),'OBS .ac-tier size unchanged');
ok(/html\.obs,body\.obs\{background:transparent!important\}/.test(HTML),'OBS stays transparent');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
