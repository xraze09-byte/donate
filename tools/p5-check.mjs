import { chromium } from 'playwright';
const b = await chromium.launch({ channel:'chrome' });
const ctx = await b.newContext({viewport:{width:1280,height:720}});
await ctx.addInitScript(()=>{ localStorage.setItem('u_theme_v1',JSON.stringify({kind:'donate-theme',v:1,skin:'persona'})); sessionStorage.setItem('p5_intro_seen',String(Date.now())); });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8092/#',{waitUntil:'load'}); await p.waitForTimeout(2500);
const r={};
// real keystrokes (isTrusted)
await p.click('#dName'); await p.keyboard.type('Tester',{delay:60});
await p.waitForTimeout(2500);
async function tryAmt(v){
  await p.click('#dAmt',{clickCount:3}); await p.keyboard.press('Backspace'); if(v) await p.keyboard.type(v,{delay:40});
  await p.evaluate(()=>{const t=document.getElementById('toast');if(t){t.textContent='';t.classList.remove('on')}});
  await p.evaluate(()=>document.querySelector('form').requestSubmit()); await p.waitForTimeout(250);
  return p.evaluate(()=>(document.getElementById('toast')||{}).textContent);
}
for (const v of ['-5','0','1e9','99999999','']) r['amt_'+v]=await tryAmt(v);
// 3D reacts: sample canvas across frames while typing big amount
r.typing = await p.evaluate(async()=>{const S=window.__P5.scene3d; const c=document.querySelector('canvas'); const grab=()=>{const g=document.createElement('canvas');g.width=64;g.height=36;const x=g.getContext('2d');x.drawImage(c,0,0,64,36);return Array.from(x.getImageData(0,0,64,36).data).reduce((a,b)=>a+b,0)};
  const a=grab(); await new Promise(r=>setTimeout(r,200)); const b=grab(); window.__P5.scene3d.typing(9000); await new Promise(r=>setTimeout(r,60)); const d=grab(); return {idleDelta:Math.abs(a-b),afterTypingDelta:Math.abs(b-d),canvasW:c.width}});
r.errs=errs; console.log(JSON.stringify(r,null,1)); await b.close();
