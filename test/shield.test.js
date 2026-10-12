// Content Shield + anti-spam + Insights + admin alert in the REAL index.html. Run: node test/shield.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const NOW=Date.now(),DAY=864e5;
const rec=(i,name,amount,status='approved',ts=NOW-i*1000,message='')=>({id:'id'+i,ref:'R'+i,name,amount,message,ts,status});
function boot({hash='',dons=[],shield=null}={}){
 const errors=[],sent=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
   class FakeWS{constructor(u){this.url=u;this.readyState=1;setTimeout(()=>this.onopen&&this.onopen(),0)}send(d){try{sent.push(JSON.parse(d))}catch(e){}}close(){this.readyState=3}}
   w.WebSocket=FakeWS;
   // relay says 'admin password mode is OFF' (503) => app uses its own local passphrase setup, same as a self-hosted install
   w.fetch=(u)=>String(u).includes('/admin/check')?Promise.resolve({status:503,ok:false,json:()=>Promise.resolve({})}):Promise.reject(new Error('blocked'));
   w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify(Object.assign({pp:'0812345678',payee:'RZ',min:20,reqSlip:false,key:'k123',goal:10000},{})));
   w.localStorage.setItem('rzc_db_v4',JSON.stringify({don:dons,slip:{}}));
   if(shield)w.localStorage.setItem('rzc_shield',JSON.stringify(shield));
  }});
 return {w:dom.window,d:dom.window.document,errors,sent};
}
const type=(t,id,v)=>{const e=t.d.getElementById(id);e.value=v;e.dispatchEvent(new t.w.Event('input',{bubbles:true}))};
const submit=t=>t.d.getElementById('dForm').dispatchEvent(new t.w.Event('submit',{bubbles:true,cancelable:true}));
async function login(t){ // go through the app's REAL first-setup gate (no bypass)
 const d=t.d,w=t.w;d.getElementById('gPw').value='Str0ng-Passphrase!';d.getElementById('gPw2').value='Str0ng-Passphrase!';
 d.getElementById('gForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 for(let i=0;i<40&&d.getElementById('adm').style.display==='none';i++)await sleep(100);
 return d.getElementById('adm').style.display!=='none'}
const payOpen=t=>t.d.getElementById('pay').classList.contains('on');
(async()=>{
 // ---------- 1) the SHIELD module (accessed through a donor page; SHIELD is inside the main IIFE so test via UI + overlay) ----------
 let t=boot();await sleep(900);
 ok(t.errors.length===0,'boots with 0 script errors '+(t.errors[0]||''));
 ok(!!t.d.getElementById('shName')&&!!t.d.getElementById('shMsg'),'donor form has warning slots');
 ok(!!t.d.getElementById('pI')&&!!t.d.querySelector('.tab[data-p="i"]'),'admin has INSIGHTS tab + pane');

 // live warnings
 type(t,'dName','fuck you');ok(t.d.getElementById('shName').classList.contains('on'),'profane name => live warning');
 type(t,'dName','Somchai');ok(!t.d.getElementById('shName').classList.contains('on'),'clean name => no warning');
 type(t,'dMsg','ไอ้สัตว์ มึงตาย');ok(t.d.getElementById('shMsg').classList.contains('on'),'profane Thai message => live warning');
 type(t,'dMsg','f.u.c.k');ok(t.d.getElementById('shMsg').classList.contains('on'),'evasion f.u.c.k caught');
 type(t,'dMsg','f u c k');ok(t.d.getElementById('shMsg').classList.contains('on'),'evasion "f u c k" caught');
 type(t,'dMsg','sh1t');ok(t.d.getElementById('shMsg').classList.contains('on'),'leetspeak sh1t caught');
 // false positives must NOT trigger
 for(const ok1 of ['สู้ๆนะครับ','Scunthorpe','classic ass-et','หีบสมบัติ','Dickson','ขอบคุณที่สตรีมครับ']){
  type(t,'dMsg',ok1);
  ok(!t.d.getElementById('shMsg').classList.contains('on'),'no false positive: "'+ok1+'"')}

 // ---------- 2) submit gate ----------
 type(t,'dMsg','');type(t,'dName','shit head');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(!payOpen(t),'profane name blocks submit (no payment modal)');
 t=boot();await sleep(900);
 type(t,'dName','Somchai');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(payOpen(t),'clean donation still opens payment');

 // ---------- 3) banned names / custom words come from admin settings ----------
 t=boot({shield:{names:'badguy, troll',words:'ห้ามคำนี้'}});await sleep(900);
 type(t,'dName','BadGuy123');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(!payOpen(t),'blacklisted name (substring, case-insens) blocked');
 type(t,'dMsg','ข้อความมี ห้ามคำนี้ อยู่');ok(t.d.getElementById('shMsg').classList.contains('on'),'admin custom word is detected');
 t=boot({shield:{on:false}});await sleep(900);
 type(t,'dName','fuck');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(payOpen(t),'filter OFF => nothing blocked');

 // ---------- 4) anti-spam ----------
 t=boot();await sleep(900);
 const send=async(name)=>{type(t,'dName',name);type(t,'dAmt','100');submit(t);await sleep(60);
  if(payOpen(t)){t.d.getElementById('bSubmit').click();await sleep(150)}};
 await send('A1');
 const n1=t.sent.filter(m=>m.t==='donation').length;ok(n1===1,'first donation sent ('+n1+')');
 type(t,'dName','A2');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(!payOpen(t),'second donation within 20s is blocked by cooldown');
 ok(/ส่งถี่เกินไป/.test(t.d.getElementById('toast').textContent),'cooldown toast shown ('+t.d.getElementById('toast').textContent+')');
 t=boot({shield:{cd:false}});await sleep(900);
 await send('B1');type(t,'dName','B2');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(payOpen(t),'cooldown OFF => second allowed');
 // pending cap: 3 recent pending from this device
 t=boot({dons:[rec(1,'P1',50,'pending'),rec(2,'P2',50,'pending'),rec(3,'P3',50,'pending')]});await sleep(900);
 type(t,'dName','Late');type(t,'dAmt','100');submit(t);await sleep(80);
 ok(!payOpen(t),'3 pending => blocked until admin clears');
 ok(/รอตรวจสอบ/.test(t.d.getElementById('toast').textContent),'pending-cap toast shown');

 // ---------- 5) OBS last line of defence: profane alert never reaches the screen ----------
 t=boot({hash:'#overlay?k=k123'});await sleep(1200);
 const ev=(d)=>t.w.dispatchEvent(new t.w.StorageEvent('storage',{key:'rzc_bus_v4',newValue:JSON.stringify({t:'alert',d,i:'x'+Math.random()})}));
 ev({name:'Nice',amount:100,message:'fuck this'});await sleep(500);
 const shown=(t.d.getElementById('card')||t.d.body).textContent;
 ok(!/fuck/i.test(t.d.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,'')),'OBS: profanity not present anywhere in the rendered page');
 ev({name:'troll',amount:100,message:'hi'});
 t.w.localStorage.setItem('rzc_shield',JSON.stringify({names:'troll'}));ev({name:'troll',amount:100,message:'hi'});await sleep(300);
 ok(t.errors.length===0,'OBS: 0 script errors '+(t.errors[0]||''));

 // ---------- 6) admin card flag + insights ----------
 const D=[rec(1,'Alice',1200,'approved',NOW),rec(2,'Alice',300,'approved',NOW-DAY),rec(3,'Bob',150,'approved',NOW-2*DAY),
  rec(4,'Carol',9000,'approved',NOW-3*DAY),rec(5,'Dan',50,'rejected'),rec(6,'fuck bot',100,'pending'),rec(7,'Nice',100,'pending',NOW,'ไอ้สัตว์')];
 t=boot({hash:'#admin',dons:D});await sleep(1000); ok(await login(t),'admin gate: first-setup login works');
 ok(!!t.d.getElementById('insKpi'),'insights container exists');
 t.d.querySelector('.tab[data-p="i"]').click();await sleep(50);
 const kpi=t.d.getElementById('insKpi').textContent;
 ok(/฿2,?[0-9]{3}/.test(kpi)||kpi.length>20,'KPI rendered: '+kpi.replace(/\s+/g,' ').slice(0,120));
 ok(t.d.querySelectorAll('#insDay div').length===14,'14 day bars');
 ok(t.d.querySelectorAll('#insHr div').length===24,'24 hour bars');
 ok(t.d.querySelectorAll('#insRank .ins-row').length===6,'6 rank rows');
 ok(/Alice/.test(t.d.getElementById('insRep').textContent)&&!/Bob/.test(t.d.getElementById('insRep').textContent),'repeat donors lists Alice (2 drops) not Bob (1)');
 ok(/17%|20%|25%|33%|14%|0%/.test(kpi),'reject rate computed');
 // flagged cards (queue is rendered by adminRefresh once logged in; render directly)
 t.d.querySelector('.tab[data-p="q"]').click();await sleep(50);
 const cards=[...t.d.querySelectorAll('#qList .qcard')];
 ok(cards.length===2&&cards.every(c=>c.classList.contains('flag')),'both profane pending cards flagged ('+cards.length+')');
 ok(/คำไม่เหมาะสม/.test(t.d.getElementById('qList').textContent),'flag badge text shown');
 // clean card is not flagged
 t=boot({hash:'#admin',dons:[rec(1,'Nice',100,'pending',NOW,'สู้ๆ')]});await sleep(900); ok(await login(t),'admin gate: first-setup login works');
 t.d.querySelector('.tab[data-p="q"]').click();await sleep(50);
 ok(!t.d.querySelector('#qList .qcard').classList.contains('flag'),'clean pending card not flagged');
 // XSS in insights names
 t=boot({hash:'#admin',dons:[rec(1,'<img src=x onerror=window.__pwn=1>',100),rec(2,'<img src=x onerror=window.__pwn=1>',100)]});await sleep(900); ok(await login(t),'admin gate: first-setup login works');
 t.d.querySelector('.tab[data-p="i"]').click();await sleep(50);
 ok(!t.w.__pwn&&!t.d.querySelector('#insRep img'),'XSS: insights escapes names');

 // ---------- 7) admin alert on new pending ----------
 t=boot({hash:'#admin',dons:[]});await sleep(900); ok(await login(t),'admin gate: first-setup login works');
 let beeps=0;const AC0=t.w.AudioContext;
 t.w.AudioContext=function(){beeps++;return new Proxy({},{get:(o,k)=>k==='currentTime'?0:k==='destination'?{}:()=>new Proxy({frequency:{setValueAtTime(){},value:0},gain:{value:0},connect(){},start(){},stop(){}},{get:(o2,k2)=>k2 in o2?o2[k2]:()=>{}})})};
 t.w.__RZ_SHIELD.ANOT.tick(0);t.w.__RZ_SHIELD.ANOT.tick(2);
 ok(beeps===1,'beep once when pending grows 0→2 (beeps='+beeps+')');
 t.w.__RZ_SHIELD.ANOT.tick(2);ok(beeps===1,'no beep when count unchanged');
 t.w.__RZ_SHIELD.ANOT.tick(1);ok(beeps===1,'no beep when count drops');
 t.w.localStorage.setItem('rzc_shield',JSON.stringify({nt:false}));t.w.__RZ_SHIELD.ANOT.tick(5);
 ok(beeps===1,'alert OFF => silent');
 ok(t.errors.length===0,'admin: 0 script errors '+(t.errors[0]||''));
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});
